-- DOC-04: NBS codes table for service classification validation.
-- Stores the official Nomenclatura Brasileira de Serviços codes (digits only).

CREATE TABLE codigos_nbs (
  codigo    VARCHAR(10) PRIMARY KEY, -- 8-digit code, dots stripped (e.g. "01010110")
  descricao TEXT NOT NULL
);

ALTER TABLE codigos_nbs ENABLE ROW LEVEL SECURITY;

-- Public read: any authenticated caller may look up NBS codes.
CREATE POLICY "nbs_public_read" ON codigos_nbs FOR SELECT USING (true);

-- Seed: representative codes for common MEI services.
INSERT INTO codigos_nbs (codigo, descricao) VALUES
  -- Tecnologia da Informação
  ('01010110', 'Desenvolvimento e produção de softwares sob encomenda'),
  ('01010120', 'Licenciamento ou cessão de direito de uso de softwares'),
  ('01010210', 'Instalação, configuração e manutenção de softwares'),
  ('01010310', 'Suporte técnico de software, inclusive instalação, configuração'),
  ('01010320', 'Atualização de software'),
  ('01010410', 'Análise de sistemas computacionais'),
  ('01010510', 'Armazenamento e backup de dados e informações'),
  ('01020100', 'Consultoria em informática'),
  ('01030100', 'Processamento de dados e congêneres'),
  ('01040100', 'Elaboração de programas de computadores, inclusive de jogos eletrônicos'),
  ('01040200', 'Licenciamento ou cessão de direito de uso de programas de computação'),
  ('01040300', 'Assessoria e consultoria em informática'),
  ('01040400', 'Análise, programação, implantação, manutenção de software'),
  -- Consultoria e assessoria
  ('17010100', 'Assessoria e consultoria em geral'),
  ('17010200', 'Análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações'),
  ('17020100', 'Datilografia, digitação, estenografia, expediente, secretaria em geral'),
  -- Serviços de design e comunicação
  ('13010100', 'Criação e desenvolvimento de sites, blogs e demais conteúdo na internet'),
  ('13010200', 'Produção de vídeos, textos, fotos, imagens e áudios para internet'),
  ('13030100', 'Elaboração de layouts, peças, material publicitário'),
  ('13050100', 'Planejamento, programação e execução de publicidade e propaganda'),
  -- Serviços administrativos e financeiros
  ('17190100', 'Serviços de tradução, interpretação e congêneres'),
  ('17190200', 'Serviços de pesquisa e desenvolvimento'),
  ('17190300', 'Planejamento, organização e administração de feiras, exposições, congressos'),
  -- Educação e treinamento
  ('12010100', 'Ensino regular pré-escolar, fundamental, médio e superior'),
  ('12020100', 'Instrução, treinamento, orientação pedagógica e educacional'),
  ('12030100', 'Elaboração e ministração de cursos, treinamentos e programas de capacitação'),
  -- Saúde e bem-estar
  ('04010100', 'Medicina e biomedicina'),
  ('04020100', 'Enfermagem, inclusive serviços auxiliares'),
  ('04030100', 'Fonoaudiologia'),
  ('04040100', 'Psicologia, psicanálise e congêneres'),
  ('04050100', 'Fisioterapia'),
  ('04060100', 'Nutrição'),
  -- Construção civil
  ('07010100', 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo'),
  ('07020100', 'Administração de obras de construção civil, hidráulicas ou elétrica'),
  -- Outros serviços comuns
  ('25010100', 'Serviços veterinários e zootécnicos, inclusive consulta'),
  ('22010100', 'Serviços de fotografia, inclusive revelação, ampliação, cópia, restituição'),
  ('22020100', 'Cinematografia e congêneres'),
  ('10010100', 'Agenciamento e corretagem de seguros'),
  ('10020100', 'Agenciamento, corretagem e intermediação de câmbio'),
  ('09010100', 'Recrutamento, agenciamento, seleção e colocação de mão-de-obra'),
  ('14010100', 'Serviços de guarda, estacionamento, armazenamento, vigilância e congêneres'),
  ('14020100', 'Serviços de portaria, recepção, zeladoria, mantenedor predial'),
  ('22030100', 'Composição gráfica, fotocomposição, clicheria, zincografia, litografia'),
  ('11010100', 'Arrendamento mercantil (leasing) de quaisquer bens, inclusive cessão de direitos'),
  ('03010100', 'Serviços de informações financeiras'),
  ('06010100', 'Serviços de reparos, consertos, restauração e conservação de edificações'),
  ('08010100', 'Execução, por administração, empreitada ou subempreitada, de obras de construção'),
  ('21010100', 'Serviços de hospedagem de qualquer natureza em hotéis e pousadas');
