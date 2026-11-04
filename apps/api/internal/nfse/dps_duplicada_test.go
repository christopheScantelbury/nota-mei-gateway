package nfse

import (
	"context"
	"crypto/tls"
	"errors"
	"testing"
)

// #278 — rejeição E0014 / após reenvio não pode virar REJEITADA se a NFS-e é desta DPS.

const dpsAssinadaTeste = `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="DPS130260322344889640001420000000000000000126"><dhEmi>2026-11-04T12:40:00-03:00</dhEmi></infDPS></DPS>`

func nfseComDhEmi(dh string) string {
	return `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS1"><dhProc>2026-11-04T12:40:05-03:00</dhProc><DPS><infDPS><dhEmi>` + dh + `</dhEmi></infDPS></DPS></infNFSe></NFSe>`
}

type fakeRecovery struct {
	dps    *NFSeNacionalSuccess
	dpsErr error
	doc    string
	docErr error
}

func (f *fakeRecovery) ConsultarDPSPorID(context.Context, string, *tls.Certificate) (*NFSeNacionalSuccess, error) {
	return f.dps, f.dpsErr
}
func (f *fakeRecovery) ConsultarNFSe(context.Context, string, *tls.Certificate) ([]byte, error) {
	return []byte(f.doc), f.docErr
}

func e0014(tentativa int) *NFSeNacionalError {
	return &NFSeNacionalError{Erros: []MensagemProcessamento{{Codigo: "E0014", Descricao: "DPS já existe"}}, Tentativa: tentativa}
}

func TestDPSPodeTerSidoProcessada(t *testing.T) {
	outra := &NFSeNacionalError{Erros: []MensagemProcessamento{{Codigo: "E0310"}}, Tentativa: 1}
	if dpsPodeTerSidoProcessada(outra) {
		t.Fatal("E0310 na 1ª tentativa é rejeição normal")
	}
	outra.Tentativa = 2
	if !dpsPodeTerSidoProcessada(outra) {
		t.Fatal("rejeição depois de reenvio precisa ser conferida")
	}
	if !dpsPodeTerSidoProcessada(e0014(1)) {
		t.Fatal("E0014 precisa ser conferido")
	}
}

func TestRecuperarDPSProcessada(t *testing.T) {
	chave := "13026032234488964000142000000000000126056414682885"
	ctx := context.Background()

	t.Run("NFS-e desta DPS → autoriza com XML oficial", func(t *testing.T) {
		f := &fakeRecovery{dps: &NFSeNacionalSuccess{ChaveAcesso: chave}, doc: nfseComDhEmi("2026-11-04T12:40:00-03:00")}
		s, fail, err := recuperarDPSProcessada(ctx, f, []byte(dpsAssinadaTeste), e0014(2), nil)
		if err != nil || fail != nil || s == nil || s.ChaveAcesso != chave {
			t.Fatalf("esperado sucesso: s=%v fail=%v err=%v", s, fail, err)
		}
		doc, dErr := DecodeNFSeXML(s.NFSeXMLGZipB64)
		if dErr != nil || ValidarXMLNFSe(doc) != nil {
			t.Fatalf("XML oficial não veio no sucesso: %v", dErr)
		}
	})
	t.Run("DPS não existe → rejeição vale", func(t *testing.T) {
		f := &fakeRecovery{dpsErr: ErrDPSNaoEncontrada}
		s, fail, err := recuperarDPSProcessada(ctx, f, []byte(dpsAssinadaTeste), e0014(1), nil)
		if s != nil || fail == nil || err != nil {
			t.Fatalf("esperado rejeição: s=%v fail=%v err=%v", s, fail, err)
		}
	})
	t.Run("NFS-e de OUTRA DPS com o mesmo número → rejeição vale", func(t *testing.T) {
		f := &fakeRecovery{dps: &NFSeNacionalSuccess{ChaveAcesso: chave}, doc: nfseComDhEmi("2026-10-01T09:00:00-03:00")}
		s, fail, err := recuperarDPSProcessada(ctx, f, []byte(dpsAssinadaTeste), e0014(1), nil)
		if s != nil || fail == nil || err != nil {
			t.Fatalf("esperado rejeição: s=%v fail=%v err=%v", s, fail, err)
		}
	})
	t.Run("consulta falha → transitório (fica PROCESSANDO, nunca REJEITADA)", func(t *testing.T) {
		for _, f := range []*fakeRecovery{
			{dpsErr: errors.New("timeout")},
			{dps: &NFSeNacionalSuccess{ChaveAcesso: chave}, docErr: errors.New("502")},
		} {
			s, fail, err := recuperarDPSProcessada(ctx, f, []byte(dpsAssinadaTeste), e0014(2), nil)
			if s != nil || fail != nil || err == nil {
				t.Fatalf("esperado erro transitório: s=%v fail=%v err=%v", s, fail, err)
			}
		}
	})
}
