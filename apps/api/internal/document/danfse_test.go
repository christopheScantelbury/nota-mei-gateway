package document

import (
	"bytes"
	"strings"
	"testing"
)

// XML sintético no formato da NFS-e Nacional v1.01 (sem dados reais).
const nfseTesteXML = `<?xml version="1.0" encoding="utf-8"?>
<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS35503082200000000000190000000000000526113409347315">
<xLocEmi>São Paulo</xLocEmi><xLocPrestacao>São Paulo</xLocPrestacao><nNFSe>52</nNFSe><cLocIncid>3550308</cLocIncid><xLocIncid>São Paulo</xLocIncid>
<xTribNac>Análise e desenvolvimento de sistemas.</xTribNac><verAplic>SefinNac_1.0</verAplic><ambGer>2</ambGer><tpEmis>1</tpEmis><procEmi>1</procEmi><cStat>100</cStat>
<dhProc>2026-11-04T12:40:05-03:00</dhProc><nDFSe>123</nDFSe>
<emit><CNPJ>00000000000191</CNPJ><xNome>Empresa Teste LTDA</xNome><enderNac><xLgr>Rua Exemplo</xLgr><nro>100</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><UF>SP</UF><CEP>01001000</CEP></enderNac></emit>
<valores><vLiq>3500.00</vLiq></valores>
<DPS versao="1.01"><infDPS Id="DPS355030820000000000019100001000000000000052"><tpAmb>1</tpAmb><dhEmi>2026-11-04T12:40:00-03:00</dhEmi><verAplic>x</verAplic><serie>00001</serie><nDPS>52</nDPS><dCompet>2026-11-04</dCompet><tpEmit>1</tpEmit><cLocEmi>3550308</cLocEmi>
<prest><CNPJ>00000000000191</CNPJ><IM>123</IM><regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest>
<toma><CNPJ>11222333000181</CNPJ><xNome>Cliente Exemplo SA</xNome><end><endNac><cMun>3304557</cMun><CEP>20040002</CEP></endNac><xLgr>Av. Teste</xLgr><nro>1</nro><xBairro>Centro</xBairro></end><email>fin@example.com</email></toma>
<serv><locPrest><cLocPrestacao>3550308</cLocPrestacao></locPrest><cServ><cTribNac>010101</cTribNac><xDescServ>Desenvolvimento de software conforme contrato</xDescServ></cServ></serv>
<valores><vServPrest><vServ>3500.00</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><pTotTribSN>6.00</pTotTribSN></totTrib></trib></valores>
</infDPS></DPS></infNFSe></NFSe>`

func TestGerarDANFSE(t *testing.T) {
	for _, cancelada := range []bool{false, true} {
		pdf, err := GerarDANFSE([]byte(nfseTesteXML), DANFSEOpcoes{
			Cancelada:     cancelada,
			NomeMunicipio: func(ibge string) string { return map[string]string{"3304557": "Rio de Janeiro - RJ"}[ibge] },
		})
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.HasPrefix(pdf, []byte("%PDF-")) || len(pdf) < 3000 {
			t.Fatalf("PDF inválido (%d bytes)", len(pdf))
		}
	}
}

func TestGerarDANFSE_RecusaDPS(t *testing.T) {
	_, err := GerarDANFSE([]byte(`<DPS><infDPS Id="DPS1"/></DPS>`), DANFSEOpcoes{})
	if err == nil {
		t.Fatal("DPS não pode virar DANFSE")
	}
}

func TestFormatacaoDANFSE(t *testing.T) {
	casos := map[string]string{
		percent("2.00"):          "2%",
		percent("2.50"):          "2,5%",
		moeda("3500"):            "R$ 3.500,00",
		moeda(""):                "-",
		formatCTribNac("010701"): "01.07.01",
		dataBR("2026-11-04"):     "04/11/2026",
		soma("1.10", "", "2"):    "3.10",
		ChaveDaNFSe("NFS123"):    "123",
	}
	for got, want := range casos {
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	}
	if !strings.Contains(opSimpNacTexto("2"), "MEI") {
		t.Error("opSimpNac 2 = MEI")
	}
}
