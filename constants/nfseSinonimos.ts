// ============================================================
// AURA. — Palavras do dia a dia para achar o código da NFS-e
//
// A Lista de Serviços Nacional (constants/nfseListaServicos.ts) fala a
// língua da lei: "Barbearia, cabeleireiros, manicuros, pedicuros e
// congêneres". Quem cadastra escreve "corte de cabelo" ou "unha". Este
// arquivo só ACRESCENTA palavras de busca a códigos que já existem na
// lista oficial — não cria código nem muda descrição. Um teste confere que
// toda chave daqui existe na lista (__tests__/nfseCadastroServico.test.tsx).
//
// Sem acento e em minúsculas (a busca normaliza os dois lados).
// ============================================================
export const SINONIMOS_NFSE: Record<string, string> = {
  // informática
  "010701": "formatacao formatar computador notebook pc instalacao de programa informatica ti suporte tecnico windows",
  "010801": "site website loja virtual pagina na internet",
  // cuidados pessoais e estética
  "060101": "corte cabelo barba barbeiro cabeleireiro manicure pedicure unha unhas escova penteado salao hidratacao progressiva coloracao tintura mechas luzes alisamento",
  "060201": "estetica esteticista limpeza de pele depilacao sobrancelha cilios design de sobrancelha micropigmentacao peeling",
  "060301": "massagem massoterapia drenagem linfatica sauna",
  "060401": "academia personal treino pilates yoga danca luta karate judo jiu-jitsu natacao",
  "060601": "tatuagem tattoo piercing",
  // saúde
  "041201": "dentista odontologia limpeza dental clareamento canal aparelho dentario",
  "040802": "fisioterapia fisioterapeuta",
  "041001": "nutricionista dieta",
  "041601": "psicologo psicologa terapia",
  // pet
  "050101": "veterinario consulta veterinaria",
  "050801": "banho e tosa tosa pet hotel para cachorro adestramento creche pet",
  // casa e obra
  "070501": "reforma pintura pedreiro",
  "071002": "faxina diarista limpeza de casa limpeza de piscina",
  "071102": "jardinagem jardineiro poda",
  "071301": "dedetizacao desinsetizacao",
  // educação
  "080201": "aula curso treinamento workshop reforco escolar professor oficina",
  // eventos e imagem
  "121701": "recreacao animacao festa infantil",
  "130301": "fotografia foto fotografo ensaio filmagem video",
  "130501": "grafica impressao",
  "171101": "organizacao de festas cerimonial",
  "230101": "design grafico logo logotipo identidade visual",
  "240101": "chaveiro copia de chave carimbo",
  "240102": "banner adesivo placa plotagem",
  // conserto e manutenção
  "140101": "conserto manutencao revisao carro moto maquina aparelho eletrodomestico oficina mecanica troca de oleo lavagem de carro lava-jato",
  "140201": "assistencia tecnica conserto celular tela notebook impressora",
  "140601": "instalacao montagem de aparelho ar condicionado",
  "140701": "moldura quadro",
  "140901": "costura ajuste barra bainha conserto de roupa costureira alfaiate",
  "141001": "lavanderia lavagem de roupa",
  "141201": "funilaria lanternagem",
  "390101": "conserto de joia joalheria ourives",
  // escritório
  "170101": "consultoria assessoria consultor mentoria",
  "170601": "marketing propaganda publicidade social media",
  "171901": "contabilidade contador",
};
