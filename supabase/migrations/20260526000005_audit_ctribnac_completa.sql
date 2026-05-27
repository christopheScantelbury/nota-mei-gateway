-- ============================================================
-- Auditoria completa CNAE → cTribNac (LC116/2003)
--
-- Resolve o problema "tenho um CNAE incomum e o picker não me mostra
-- nada útil" via 4 camadas:
--
--  1. Expansão do catálogo codigos_nbs (~50 novos códigos cobrindo
--     saúde, engenharia, construção, beleza, alimentação, transporte)
--
--  2. Validação curada: marca ctrib_nac_valido baseado em códigos
--     LC116 que historicamente são aceitos pela Receita Federal
--
--  3. Mapping ampliado cnae_ctribnac — cobre ~150 CNAEs MEI mais
--     comuns da Resolução CGSN Anexo XI
--
--  4. Kit universal MEI: linha sentinela cnae_codigo='0000000' com
--     6 ctribs que todo MEI pode emitir (consultoria, secretaria,
--     cursos, design, dev, marketing). UI inclui automaticamente.
-- ============================================================

-- ─── 1. Expansão codigos_nbs ─────────────────────────────────
-- Adiciona NBS codes pra setores que não estavam cobertos.

INSERT INTO codigos_nbs (codigo, descricao) VALUES
  -- ── Saúde e bem-estar (LC item 4) — expansão ──
  ('04070100', 'Obstetrícia'),
  ('04080100', 'Odontologia'),
  ('04090100', 'Ortóptica'),
  ('04100100', 'Próteses sob encomenda'),
  ('04110100', 'Psicanálise'),
  ('04120100', 'Terapia ocupacional, fisioterapia e fonoaudiologia'),
  ('04130100', 'Terapias de qualquer espécie destinadas ao tratamento físico'),
  ('04140100', 'Acupuntura'),
  ('04150100', 'Enfermagem, inclusive serviços auxiliares'),
  ('04160100', 'Serviços farmacêuticos'),
  ('04170100', 'Assistência médica veterinária'),

  -- ── Cuidados pessoais e estética (LC item 6) ──
  ('06010200', 'Barbearia, cabeleireiros, manicuros, pedicuros e congêneres'),
  ('06020100', 'Esteticistas, tratamento de pele, depilação e congêneres'),
  ('06030100', 'Banhos, duchas, sauna, massagens e congêneres'),
  ('06040100', 'Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas'),
  ('06050100', 'Centros de emagrecimento, spa e congêneres'),

  -- ── Engenharia e arquitetura (LC item 7) — expansão ──
  ('07020200', 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil'),
  ('07030100', 'Elaboração de planos diretores, estudos de viabilidade'),
  ('07040100', 'Demolição de edificações'),
  ('07050100', 'Reparação, conservação e reforma de edifícios, estradas, pontes, portos'),
  ('07060100', 'Colocação e instalação de tapetes, carpetes, assoalhos, cortinas, revestimentos'),
  ('07070100', 'Recuperação, raspagem, polimento e lustração de pisos e congêneres'),
  ('07080100', 'Calafetação'),
  ('07090100', 'Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes'),
  ('07100100', 'Limpeza, manutenção e conservação de vias e logradouros públicos'),
  ('07110100', 'Decoração e jardinagem, inclusive corte e poda de árvores'),
  ('07120100', 'Controle e tratamento de efluentes de qualquer natureza'),
  ('07130100', 'Dedetização, desinfecção, desinsetização, imunização, higienização, desratização'),
  ('07160100', 'Florestamento, reflorestamento, semeadura, adubação e congêneres'),
  ('07170100', 'Escoramento, contenção de encostas e serviços congêneres'),
  ('07180100', 'Limpeza e dragagem de rios'),
  ('07210100', 'Pesquisa, perfuração, cimentação, mergulho, perfilagem'),
  ('07220100', 'Nucleação e bombardeamento de nuvens e congêneres'),

  -- ── Alimentação e hospedagem (LC item 9 e 17) ──
  ('09020100', 'Agenciamento, organização, promoção, intermediação de programas de turismo'),
  ('09030100', 'Guias de turismo'),

  -- ── Intermediação e corretagem (LC item 10) ──
  ('10030100', 'Agenciamento, corretagem ou intermediação de direitos de propriedade industrial'),
  ('10040100', 'Agenciamento, corretagem ou intermediação de contratos de arrendamento mercantil (leasing)'),
  ('10050100', 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis'),
  ('10080100', 'Agenciamento de notícias'),
  ('10090100', 'Agenciamento de publicidade e propaganda'),
  ('10100100', 'Representação de qualquer natureza, inclusive comercial'),

  -- ── Diversões e lazer (LC item 12) ──
  ('12010200', 'Cinemas'),
  ('12020100', 'Bilhares, boliches e diversões eletrônicas ou não'),
  ('12100100', 'Festas, recepções, bufê, serviços de música, decoração'),
  ('12110100', 'Recreação e animação, inclusive em festas e eventos de qualquer natureza'),

  -- ── Reparos e bens de terceiros (LC item 14) — corretos ──
  ('14030100', 'Recondicionamento de motores'),
  ('14040100', 'Recauchutagem ou regeneração de pneus'),
  ('14050100', 'Restauração, recondicionamento, acondicionamento, pintura, beneficiamento'),
  ('14060100', 'Instalação e montagem de aparelhos, máquinas e equipamentos'),
  ('14070100', 'Colocação de molduras e congêneres'),
  ('14080100', 'Encadernação, gravação e douração de livros, revistas e congêneres'),
  ('14090100', 'Alfaiataria e costura, quando o material for fornecido pelo usuário final'),
  ('14100100', 'Tinturaria e lavanderia'),
  ('14110100', 'Tapeçaria e reforma de estofamentos em geral'),
  ('14120100', 'Funilaria e lanternagem'),
  ('14130100', 'Carpintaria e serralheria'),

  -- ── Transporte municipal (LC item 16) ──
  ('16010100', 'Serviços de transporte coletivo municipal rodoviário, metroviário, ferroviário e aquaviário'),
  ('16020100', 'Outros serviços de transporte municipal'),

  -- ── Apoio técnico/administrativo (LC item 17) — expansão ──
  ('17030100', 'Planejamento, coordenação, programação ou organização técnica, financeira ou administrativa'),
  ('17040100', 'Recrutamento, agenciamento, seleção e colocação de mão-de-obra'),
  ('17050100', 'Fornecimento de mão-de-obra, mesmo em caráter temporário'),
  ('17080100', 'Franquia (franchising)'),
  ('17090100', 'Perícias, laudos, exames técnicos e análises técnicas'),
  ('17100100', 'Planejamento, organização e administração de feiras, exposições, congressos e congêneres'),
  ('17110100', 'Organização de festas e recepções; bufê'),
  ('17120100', 'Administração em geral, inclusive de bens e negócios de terceiros'),
  ('17130100', 'Leilão e congêneres'),
  ('17140100', 'Advocacia'),
  ('17150100', 'Arbitragem de qualquer espécie, inclusive jurídica'),
  ('17160100', 'Auditoria'),
  ('17170100', 'Análise de Organização e Métodos'),
  ('17180100', 'Atuária e cálculos técnicos de qualquer natureza'),
  ('17190100', 'Contabilidade, inclusive serviços técnicos e auxiliares'),
  ('17200100', 'Consultoria e assessoria econômica ou financeira'),
  ('17210100', 'Estatística'),
  ('17220100', 'Cobrança em geral'),
  ('17230100', 'Assessoria, análise, avaliação, atendimento, consulta, cadastro, seleção, gerenciamento de informações'),
  ('17240100', 'Apresentação de palestras, conferências, seminários e congêneres')
ON CONFLICT (codigo) DO NOTHING;

-- ─── 2. Validação curada de ctrib_nac_valido ─────────────────
-- Marca como válidos os ctribs LC116 que aceitam emissão na Receita.
-- Lista baseada em curadoria + códigos comprovadamente funcionando.

UPDATE codigos_nbs SET ctrib_nac_valido = true
 WHERE ctrib_nac IN (
   -- ── Item 1 — Informática ──
   '010101',  -- Análise e desenvolvimento de sistemas
   '010201',  -- Programação
   '010301',  -- Processamento, armazenamento ou hospedagem de dados
   '010401',  -- Elaboração de programas de computadores
   '010501',  -- Licenciamento ou cessão de direito de uso de programas
   '010701',  -- Suporte técnico em informática
   '010801',  -- Planejamento, confecção, manutenção e atualização de páginas eletrônicas
   '011401',  -- Elaboração de programas de computadores (variante)

   -- ── Item 4 — Saúde ──
   '040101',  -- Medicina e biomedicina
   '040201',  -- Análises clínicas, patologia, eletricidade médica
   '040301',  -- Hospitais, clínicas, laboratórios, sanatórios
   '040401',  -- Instrumentação cirúrgica
   '040501',  -- Acupuntura
   '040601',  -- Enfermagem, inclusive serviços auxiliares
   '040701',  -- Fonoaudiologia
   '040801',  -- Próteses sob encomenda
   '040901',  -- Psicologia
   '041001',  -- Casas de repouso e congêneres
   '041101',  -- Coleta de sangue, leite, tecidos, sêmen e órgãos
   '041201',  -- Fisioterapia
   '041301',  -- Plano de medicina de grupo
   '041401',  -- Outplacement

   -- ── Item 6 — Cuidados pessoais ──
   '060101',  -- Barbearia, cabeleireiros, manicuros, pedicuros
   '060201',  -- Esteticistas, tratamento de pele, depilação
   '060301',  -- Banhos, duchas, sauna, massagens
   '060401',  -- Ginástica, dança, esportes, artes marciais
   '060501',  -- Centros de emagrecimento, spa

   -- ── Item 7 — Engenharia, arquitetura ──
   '070101',  -- Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo
   '070201',  -- Execução de obras de construção civil
   '070301',  -- Elaboração de planos diretores, estudos de viabilidade
   '070501',  -- Reparação, conservação e reforma de edifícios
   '070601',  -- Colocação e instalação de tapetes, carpetes
   '070701',  -- Recuperação, raspagem, polimento de pisos
   '071101',  -- Decoração e jardinagem
   '071301',  -- Dedetização, desinfecção, desinsetização

   -- ── Item 8 — Educação ──
   '080101',  -- Ensino regular pré-escolar, fundamental, médio e superior
   '080201',  -- Instrução, treinamento, avaliação de conhecimentos

   -- ── Item 12 — Diversões ──
   '120201',  -- Instrução, treinamento, orientação pedagógica
   '120301',  -- Cursos, treinamentos, capacitação

   -- ── Item 13 — Fonografia, fotografia ──
   '130101',  -- Criação de sites, blogs e conteúdo internet
   '130301',  -- Layouts, peças, material publicitário
   '130501',  -- Publicidade e propaganda

   -- ── Item 14 — Bens de terceiros (parcialmente válidos) ──
   '140301',  -- Recondicionamento de motores
   '140501',  -- Restauração, recondicionamento, pintura, beneficiamento
   '140601',  -- Instalação e montagem de aparelhos, máquinas
   '141001',  -- Tinturaria e lavanderia

   -- ── Item 17 — Apoio técnico/administrativo ──
   '170101',  -- Assessoria e consultoria em geral
   '170201',  -- Datilografia, digitação, secretaria
   '170301',  -- Planejamento, coordenação, programação técnica/financeira/administrativa
   '170401',  -- Recrutamento, agenciamento, colocação de mão-de-obra
   '171001',  -- Planejamento e administração de feiras, exposições, congressos
   '171101',  -- Organização de festas e recepções, bufê
   '171201',  -- Administração em geral, bens e negócios de terceiros
   '171401',  -- Advocacia
   '171601',  -- Auditoria
   '171901',  -- Contabilidade
   '172001',  -- Consultoria e assessoria econômica ou financeira
   '172201',  -- Cobrança em geral
   '172401'   -- Apresentação de palestras, conferências, seminários
);

-- E desmarca códigos com problema histórico
UPDATE codigos_nbs SET ctrib_nac_valido = false
 WHERE ctrib_nac IN (
   '140101'   -- Receita rejeita (já marcado em 20260526000004, garantia idempotente)
 );

-- ─── 3. Kit universal MEI ────────────────────────────────────
-- Linha sentinela cnae_codigo='0000000' representa "qualquer CNAE".
-- O endpoint /api/nbs/buscar inclui automaticamente esses códigos
-- junto com os mappings específicos do CNAE do usuário.

INSERT INTO cnae_ctribnac (cnae_codigo, ctrib_nac, descricao_cnae, permitido_mei) VALUES
  ('0000000', '170101', 'KIT UNIVERSAL — Assessoria e consultoria em geral',           true),
  ('0000000', '170201', 'KIT UNIVERSAL — Secretaria, expediente, digitação',            true),
  ('0000000', '120301', 'KIT UNIVERSAL — Cursos, treinamentos, capacitação',            true),
  ('0000000', '130301', 'KIT UNIVERSAL — Layouts, peças, material publicitário',        true),
  ('0000000', '130501', 'KIT UNIVERSAL — Publicidade e propaganda',                     true),
  ('0000000', '010101', 'KIT UNIVERSAL — Desenvolvimento e produção de softwares',      true)
ON CONFLICT (cnae_codigo, ctrib_nac) DO NOTHING;

-- ─── 4. Expansão massiva cnae_ctribnac ──────────────────────
-- Cobre os CNAEs MEI mais comuns da Resolução CGSN Anexo XI (2023+).
-- Cada CNAE recebe 1-3 ctribs válidos relevantes ao tipo de atividade.

INSERT INTO cnae_ctribnac (cnae_codigo, ctrib_nac, descricao_cnae, permitido_mei) VALUES
  -- ─────── INFORMÁTICA E COMUNICAÇÃO (Divisão 47, 61, 62, 63) ───────
  ('4751201', '010701', 'Comércio varejista esp. equipamentos e suprimentos de informática (assistência)', true),
  ('4751202', '010701', 'Recarga de cartuchos para equipamentos de informática', true),
  ('6110803', '010301', 'Serviços de comunicação multimídia - SCM', true),
  ('6190601', '010701', 'Provedores de acesso às redes de comunicações', true),
  ('6190699', '010301', 'Outras atividades de telecomunicações NCM', true),

  -- ─────── SAÚDE (Divisão 86) ───────
  ('8630501', '040101', 'Atividade médica ambulatorial com recursos para diagnóstico', true),
  ('8630502', '040101', 'Atividade médica ambulatorial com recursos para procedimentos cirúrgicos', true),
  ('8630503', '040101', 'Atividade médica ambulatorial restrita a consultas', true),
  ('8650001', '040601', 'Atividades de enfermagem', true),
  ('8650002', '040501', 'Atividades de profissionais da nutrição', true),
  ('8650003', '041201', 'Atividades de fisioterapia', true),
  ('8650004', '040701', 'Atividades de fonoaudiologia', true),
  ('8650005', '041201', 'Atividades de terapia ocupacional', true),
  ('8650006', '040901', 'Atividades de psicologia e psicanálise', true),
  ('8650007', '040501', 'Atividades de acupuntura', true),
  ('8650099', '040101', 'Outras atividades de profissionais da área de saúde NCM', true),
  ('8690901', '040501', 'Atividades de práticas integrativas e complementares em saúde humana', true),
  ('8690902', '040101', 'Atividades de bancos de leite humano', true),
  ('8690903', '040201', 'Atividades de acupuntura', true),
  ('8690904', '040501', 'Atividades de podologia', true),
  ('8690999', '040101', 'Outras atividades de atenção à saúde humana NCM', true),

  -- ─────── ALIMENTAÇÃO (Divisão 56) ───────
  ('5611201', '171101', 'Restaurantes e similares', true),
  ('5611202', '171101', 'Bares e outros estabelecimentos especializados em servir bebidas', true),
  ('5611203', '171101', 'Lanchonetes, casas de chá, de sucos e similares', true),
  ('5612100', '171101', 'Serviços ambulantes de alimentação', true),
  ('5620101', '171101', 'Fornecimento de alimentos preparados preponderantemente para empresas', true),
  ('5620102', '171101', 'Serviços de alimentação para eventos e recepções - bufê', true),
  ('5620103', '171101', 'Cantinas - serviços de alimentação privativos', true),
  ('5620104', '171101', 'Fornecimento de alimentos preparados preponderantemente para consumo domiciliar', true),

  -- ─────── BELEZA E ESTÉTICA (Divisão 96) ───────
  ('9602501', '060101', 'Cabeleireiros, manicure e pedicure', true),
  ('9602502', '060201', 'Atividades de estética e outros serviços de cuidados com a beleza', true),
  ('9603304', '171201', 'Serviços de funerárias', true),
  ('9603305', '171201', 'Serviços de somatoconservação', true),
  ('9609201', '060301', 'Clínicas de estética e similares', true),
  ('9609202', '060501', 'Agências matrimoniais', true),
  ('9609204', '060201', 'Exploração de máquinas de serviços pessoais acionadas por moeda', true),
  ('9609205', '060501', 'Atividades de sauna e banhos', true),
  ('9609206', '060501', 'Serviços de tatuagem e colocação de piercing', true),
  ('9609207', '060501', 'Alojamento de animais domésticos', true),
  ('9609299', '060501', 'Outras atividades de serviços pessoais NCM', true),

  -- ─────── EDUCAÇÃO (Divisão 85) — expansão ───────
  ('8520100', '080101', 'Ensino fundamental', true),
  ('8531700', '080101', 'Educação superior - graduação', true),
  ('8532500', '080101', 'Educação superior - graduação e pós-graduação', true),
  ('8541400', '080101', 'Educação profissional de nível técnico', true),
  ('8542200', '080101', 'Educação profissional de nível tecnológico', true),
  ('8550301', '120301', 'Administração de caixas escolares', true),
  ('8591100', '120301', 'Ensino de esportes', true),
  ('8592999', '120301', 'Ensino de arte e cultura NCM', true),
  ('8593700', '120301', 'Ensino de idiomas', true),
  ('8599604', '120201', 'Treinamento em desenvolvimento profissional e gerencial', true),
  ('8599605', '120201', 'Cursos preparatórios para concursos', true),
  ('8599699', '120201', 'Outras atividades de ensino NCM', true),

  -- ─────── ENGENHARIA E ARQUITETURA (Divisão 71) ───────
  ('7111100', '070101', 'Serviços de arquitetura', true),
  ('7112000', '070101', 'Serviços de engenharia', true),
  ('7119701', '070101', 'Serviços de cartografia, topografia e geodésia', true),
  ('7119702', '070101', 'Atividades de estudos geológicos', true),
  ('7119703', '070301', 'Serviços de desenho técnico relacionados à arquitetura e engenharia', true),
  ('7119704', '070301', 'Serviços de perícia técnica relacionados à segurança do trabalho', true),
  ('7119799', '070101', 'Atividades técnicas relacionadas à engenharia e arquitetura NCM', true),
  ('7120100', '170901', 'Testes e análises técnicas', true),

  -- ─────── CONSTRUÇÃO CIVIL (Divisão 41, 42, 43) ───────
  ('4120400', '070201', 'Construção de edifícios', true),
  ('4211101', '070201', 'Construção de rodovias e ferrovias', true),
  ('4213800', '070201', 'Obras de urbanização - ruas, praças e calçadas', true),
  ('4221903', '070201', 'Manutenção de redes de distribuição de energia elétrica', true),
  ('4221904', '070201', 'Construção de estações e redes de telecomunicações', true),
  ('4221905', '070201', 'Manutenção de estações e redes de telecomunicações', true),
  ('4291000', '070201', 'Obras portuárias, marítimas e fluviais', true),
  ('4299501', '070201', 'Construção de instalações esportivas e recreativas', true),
  ('4299599', '070201', 'Outras obras de engenharia civil NCM', true),
  ('4311801', '070401', 'Demolição de edifícios e outras estruturas', true),
  ('4311802', '070401', 'Preparação de canteiro e limpeza de terreno', true),
  ('4312600', '070101', 'Perfurações e sondagens', true),
  ('4313400', '070201', 'Obras de terraplenagem', true),
  ('4319300', '070201', 'Serviços de preparação do terreno NCM', true),
  ('4321500', '070501', 'Instalação e manutenção elétrica', true),
  ('4322301', '070501', 'Instalações hidráulicas, sanitárias e de gás', true),
  ('4322302', '070501', 'Instalação e manutenção de sistemas centrais de ar condicionado', true),
  ('4322303', '070501', 'Instalações de sistema de prevenção contra incêndio', true),
  ('4329101', '070501', 'Instalação de painéis publicitários', true),
  ('4329102', '070501', 'Instalação de equipamentos para orientação à navegação marítima', true),
  ('4329103', '070501', 'Instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes', true),
  ('4329104', '070501', 'Montagem e instalação de sistemas e equipamentos de iluminação', true),
  ('4329105', '070501', 'Tratamentos térmicos, acústicos ou de vibração', true),
  ('4329199', '070501', 'Outras obras de instalações em construções NCM', true),
  ('4330401', '070501', 'Impermeabilização em obras de engenharia civil', true),
  ('4330402', '070501', 'Instalação de portas, janelas, tetos, divisórias e armários embutidos', true),
  ('4330403', '070501', 'Obras de acabamento em gesso e estuque', true),
  ('4330404', '070601', 'Serviços de pintura de edifícios em geral', true),
  ('4330405', '070701', 'Aplicação de revestimentos e de resinas em interiores e exteriores', true),
  ('4330499', '070501', 'Outras obras de acabamento da construção NCM', true),
  ('4391600', '070201', 'Obras de fundações', true),
  ('4399101', '070201', 'Administração de obras', true),
  ('4399102', '070201', 'Montagem e desmontagem de andaimes e outras estruturas temporárias', true),
  ('4399103', '070201', 'Obras de alvenaria', true),
  ('4399104', '070501', 'Serviços de operação e fornecimento de equipamentos para transporte e elevação', true),
  ('4399105', '070701', 'Perfuração e construção de poços de água', true),
  ('4399199', '070201', 'Serviços especializados para construção NCM', true),

  -- ─────── REPARAÇÃO E MANUTENÇÃO (Divisão 95) ───────
  ('9511800', '170101', 'Reparação computadores - kit alternativo', true),
  ('9511800', '010701', 'Reparação computadores - suporte TI', true),
  ('9512600', '170101', 'Reparação periféricos - kit alternativo', true),
  ('9512600', '010701', 'Reparação periféricos - suporte TI', true),
  ('9521500', '170101', 'Reparação eletrodomésticos - assessoria', true),
  ('9529104', '140501', 'Reparação de bicicletas, triciclos e outros veículos não-motorizados', true),
  ('9529199', '170101', 'Reparação e manutenção de outros objetos pessoais e domésticos', true),

  -- ─────── TRANSPORTE (Divisão 49) ───────
  ('4923001', '160101', 'Serviço de táxi', true),
  ('4923002', '160101', 'Serviço de transporte de passageiros - locação de automóveis com motorista', true),
  ('4929901', '160101', 'Transporte rodoviário coletivo de passageiros sob regime de fretamento', true),
  ('4929902', '160101', 'Transporte rodoviário coletivo de passageiros municipal', true),
  ('4929999', '160101', 'Outros transportes rodoviários de passageiros NCM', true),

  -- ─────── CONFECÇÃO E COSTURA (Divisão 14) ───────
  ('1412601', '140901', 'Confecção, sob medida, de peças do vestuário, exceto roupas íntimas', true),
  ('1412602', '140901', 'Confecção, sob medida, de roupas íntimas', true),
  ('1413403', '140901', 'Facção de roupas profissionais', true),
  ('1414200', '140901', 'Fabricação de acessórios do vestuário, exceto para segurança e proteção', true),
  ('9529105', '141101', 'Reparação de artigos do mobiliário', true),

  -- ─────── FOTOGRAFIA E DESIGN (Divisão 74) — expansão ───────
  ('7410201', '130301', 'Design gráfico', true),
  ('7410202', '130301', 'Design de produto', true),
  ('7410203', '130301', 'Design de interiores', true),
  ('7410299', '130301', 'Atividades de design NCM', true),
  ('7420001', '130101', 'Atividades de fotografia em geral', true),
  ('7420002', '130101', 'Atividades de produção de fotografias aéreas e submarinas', true),
  ('7420003', '130101', 'Laboratórios fotográficos', true),
  ('7420004', '130101', 'Filmagem de festas e eventos', true),
  ('7420005', '130101', 'Serviços de microfilmagem', true),

  -- ─────── EVENTOS E TURISMO (Divisão 79, 82) ───────
  ('7911200', '170101', 'Agências de viagens', true),
  ('7912100', '170101', 'Operadores turísticos', true),
  ('7990200', '170101', 'Serviços de reservas e outros serviços de turismo NCM', true),
  ('8230001', '171001', 'Serviços de organização de feiras, congressos, exposições e festas', true),
  ('8230002', '171001', 'Casas de festas e eventos', true),

  -- ─────── CONSULTORIA E SERVIÇOS PROFISSIONAIS (Divisão 70, 73, 74) ───────
  ('7020400', '170101', 'Atividades de consultoria em gestão empresarial', true),
  ('7311400', '130501', 'Agências de publicidade', true),
  ('7312200', '130501', 'Agenciamento de espaços para publicidade, exceto em veículos de comunicação', true),
  ('7319001', '130501', 'Criação de estandes para feiras e exposições', true),
  ('7319002', '130501', 'Promoção de vendas', true),
  ('7319003', '130501', 'Marketing direto', true),
  ('7319004', '130501', 'Consultoria em publicidade', true),
  ('7319099', '130501', 'Outras atividades de publicidade NCM', true),
  ('7320300', '170101', 'Pesquisas de mercado e de opinião pública', true),
  ('7490103', '170101', 'Serviços de agronomia e de consultoria às atividades agrícolas', true),
  ('7490104', '170101', 'Atividades de intermediação e agenciamento de serviços', true),
  ('7490105', '170101', 'Agenciamento de profissionais para atividades esportivas, culturais e artísticas', true),
  ('7490199', '170101', 'Outras atividades profissionais NCM', true),
  ('6920601', '171901', 'Atividades de contabilidade', true),
  ('6920602', '171901', 'Atividades de consultoria e auditoria contábil e tributária', true),

  -- ─────── LIMPEZA E CONSERVAÇÃO (Divisão 81) ───────
  ('8121400', '171201', 'Limpeza em prédios e em domicílios', true),
  ('8122200', '171201', 'Imunização e controle de pragas urbanas', true),
  ('8129000', '171201', 'Atividades de limpeza NCM', true),
  ('8130300', '071101', 'Atividades paisagísticas', true),

  -- ─────── SEGURANÇA E VIGILÂNCIA (Divisão 80) ───────
  ('8011101', '171201', 'Atividades de vigilância e segurança privada', true),
  ('8012900', '171201', 'Atividades de transporte de valores', true),
  ('8020001', '171201', 'Atividades de monitoramento de sistemas de segurança eletrônico', true),

  -- ─────── CULTURA, ESPORTE E LAZER (Divisão 90, 93) ───────
  ('9001901', '170101', 'Produção teatral', true),
  ('9001902', '170101', 'Produção musical', true),
  ('9001903', '130101', 'Produção de espetáculos de dança', true),
  ('9001904', '170101', 'Produção de espetáculos circenses, marionetes e similares', true),
  ('9001905', '171101', 'Produção de espetáculos para rodeios, vaquejadas e similares', true),
  ('9001906', '170101', 'Atividades de sonorização e iluminação', true),
  ('9001999', '170101', 'Outras atividades artísticas e de espetáculos NCM', true),
  ('9311500', '060401', 'Gestão de instalações de esportes', true),
  ('9312300', '060401', 'Clubes sociais, esportivos e similares', true),
  ('9313100', '060401', 'Atividades de condicionamento físico', true),
  ('9319101', '060401', 'Produção e promoção de eventos esportivos', true),
  ('9319199', '060401', 'Outras atividades esportivas NCM', true),

  -- ─────── COMÉRCIO E ADMINISTRAÇÃO (Divisão 47, 82) ───────
  ('8211300', '170201', 'Serviços combinados de escritório e apoio administrativo', true),
  ('8219901', '170201', 'Fotocópias', true),
  ('8219999', '170201', 'Preparação de documentos e serviços especializados de apoio administrativo NCM', true),
  ('8291100', '172201', 'Atividades de cobrança e informações cadastrais', true),
  ('8292000', '170201', 'Envasamento e empacotamento sob contrato', true),
  ('8299701', '170201', 'Medição de consumo de energia elétrica, gás e água', true),
  ('8299702', '170301', 'Emissão de vales-alimentação, vales-transporte e similares', true),
  ('8299703', '170301', 'Serviços de gravação de carimbos, exceto confecção', true),
  ('8299704', '170301', 'Leiloeiros independentes', true),
  ('8299705', '170201', 'Serviços de levantamento de fundos sob contrato', true),
  ('8299706', '170201', 'Casas lotéricas', true),
  ('8299707', '170301', 'Salas de acesso à internet', true),
  ('8299799', '170201', 'Outras atividades de serviços prestados principalmente às empresas NCM', true)

ON CONFLICT (cnae_codigo, ctrib_nac) DO NOTHING;

-- ─── 5. Documentação inline ──────────────────────────────────

COMMENT ON COLUMN cnae_ctribnac.cnae_codigo IS
  'CNAE 7 dígitos (sem ponto-hífen). Valor especial "0000000" = kit universal MEI aplicado a todos os CNAEs.';
