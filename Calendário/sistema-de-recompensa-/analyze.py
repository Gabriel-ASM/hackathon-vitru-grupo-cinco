import pandas as pd
import sys

def main():
    file_path = 'dataset_aluno_predicted_20260807_hac.xlsx'
    print("Loading dataset...")
    df = pd.read_excel(file_path)
    
    print(f"Total alunos: {len(df)}")
    print(f"\n--- COLUNAS COMPLETAS ---")
    for i, col in enumerate(df.columns):
        print(f"  [{i}] {col} (dtype: {df[col].dtype}, nulls: {df[col].isnull().sum()}, unique: {df[col].nunique()})")
    
    print(f"\n--- AMOSTRA DE 5 LINHAS (TODAS AS COLUNAS) ---")
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', 50)
    print(df.head(5).T.to_string())
    
    # Focus: Students who don't take any exams / don't deliver activities
    print(f"\n\n{'='*80}")
    print(f"FOCO: ALUNOS QUE NAO RESPONDEM PROVAS / NAO ENTREGAM ATIVIDADES")
    print(f"{'='*80}")
    
    # PC_DESEMP_PROVA = 0 -> never did any exam
    zero_prova = df[df['PC_DESEMP_PROVA'] == 0]
    print(f"\nAlunos com PC_DESEMP_PROVA = 0 (nunca fizeram prova): {len(zero_prova)} ({len(zero_prova)/len(df)*100:.1f}%)")
    
    # PC_ATIVIDADE_ENTREGUE = 0
    zero_ativ = df[df['PC_ATIVIDADE_ENTREGUE'] == 0]
    print(f"Alunos com PC_ATIVIDADE_ENTREGUE = 0 (nenhuma entrega): {len(zero_ativ)} ({len(zero_ativ)/len(df)*100:.1f}%)")
    
    # QT_ATV_ENTREGUE = 0
    zero_qtd_ativ = df[df['QT_ATV_ENTREGUE'] == 0]
    print(f"Alunos com QT_ATV_ENTREGUE = 0 (zero atividades): {len(zero_qtd_ativ)} ({len(zero_qtd_ativ)/len(df)*100:.1f}%)")
    
    # Both zero
    zero_both = df[(df['PC_DESEMP_PROVA'] == 0) & (df['PC_ATIVIDADE_ENTREGUE'] == 0)]
    print(f"Alunos com prova=0 E atividade=0 (fantasmas completos): {len(zero_both)} ({len(zero_both)/len(df)*100:.1f}%)")
    
    # PC_DISC_APROV = 0
    zero_aprov = df[df['PC_DISC_APROV'] == 0]
    print(f"Alunos com PC_DISC_APROV = 0 (nenhuma disciplina aprovada): {len(zero_aprov)} ({len(zero_aprov)/len(df)*100:.1f}%)")
    
    # QT_DIA_ACESSO_TOTAL = 0
    zero_acesso = df[df['QT_DIA_ACESSO_TOTAL'] == 0]
    print(f"Alunos com QT_DIA_ACESSO_TOTAL = 0 (nunca acessaram AVA): {len(zero_acesso)} ({len(zero_acesso)/len(df)*100:.1f}%)")
    
    print(f"\n--- PERFIL DO ALUNO 'FANTASMA' (prova=0 E atividade=0) ---")
    if len(zero_both) > 0:
        print(f"  Idade media: {zero_both['QT_IDADE_ALUNO'].mean():.1f}")
        print(f"  Dias de acesso ao AVA (media): {zero_both['QT_DIA_ACESSO_TOTAL'].mean():.1f}")
        print(f"  Acesso semana de entrega (media): {zero_both['QT_ACESSO_AVA_SEMANA_ENTREGA_ATV'].mean():.1f}")
        print(f"  Aulas ao vivo assistidas (%): {zero_both['PC_AULA_AOVIVO_ASSISTIDA'].mean():.1f}")
        print(f"  Aulas conceituais (%): {zero_both['PC_AULA_CONCEITUAL_ASSISTIDA'].mean():.1f}")
        print(f"  Engajamento financeiro (%): {zero_both['PC_ENGAJAMENTO_FINANCEIRO'].mean():.1f}")
        print(f"  Renegociacao (%): {zero_both['PC_RENEGOCIACAO'].mean():.1f}")
        print(f"  Entrada tardia (%): {zero_both['FL_ENTRADA_TARDIA'].mean()*100:.1f}%")
        print(f"  Intencionou cancelamento (%): {zero_both['FL_INTENCIONOU_CANCELAMENTO'].mean()*100:.1f}%")
        print(f"  Evadiu (%): {zero_both['FL_EVADIU'].mean()*100:.1f}%")
        print(f"  Evadiu ou intencionou (%): {zero_both['FL_EVADIU_OU_INTENCIONOU'].mean()*100:.1f}%")
        print(f"  Fez questionario espaco calouro (%): {zero_both['FL_FEZ_QUEST_ESPACO_CALOURO'].mean()*100:.1f}%")
        print(f"  Fez questionario conheca EAD (%): {zero_both['FL_FEZ_QUEST_CONHECA_EAD'].mean()*100:.1f}%")
        print(f"  Acessou conheca EAD (%): {zero_both['FL_ACESSOU_CONHECA_EAD'].mean()*100:.1f}%")
        print(f"  Aluno sem espaco calouro (%): {zero_both['FL_ALUNO_SEM_ESPACO_CALOURO'].mean()*100:.1f}%")
        print(f"  Dias ate primeiro acesso (media): {zero_both['QT_DIA_ATE_PRI_ACESSO'].mean():.1f}")
        print(f"  Conclusao curso (%): {zero_both['PC_CONCLUSAO_CURSO'].mean():.1f}")
        
        print(f"\n  Distribuicao por tipo (NM_TIPO_ALUNO):")
        print(zero_both['NM_TIPO_ALUNO'].value_counts().to_string())
        
        print(f"\n  Distribuicao por cluster de risco (NM_CLUSTER_PROBA):")
        print(zero_both['NM_CLUSTER_PROBA'].value_counts().to_string())
        
        print(f"\n  Probabilidade media de evasao: {zero_both['Y_PROBA_EVADIU'].mean():.1f}%")
    
    # Compare: fantasmas vs ativos
    print(f"\n--- COMPARACAO: FANTASMAS vs ATIVOS ---")
    ativos = df[(df['PC_DESEMP_PROVA'] > 0) | (df['PC_ATIVIDADE_ENTREGUE'] > 0)]
    print(f"{'Metrica':<45} {'Fantasmas':>12} {'Ativos':>12} {'Delta':>10}")
    print("-" * 80)
    metrics = [
        ('QT_IDADE_ALUNO', 'Idade media'),
        ('QT_DIA_ACESSO_TOTAL', 'Dias acesso AVA'),
        ('PC_AULA_AOVIVO_ASSISTIDA', 'Aulas ao vivo (%)'),
        ('PC_AULA_CONCEITUAL_ASSISTIDA', 'Aulas conceituais (%)'),
        ('PC_ENGAJAMENTO_FINANCEIRO', 'Engaj. financeiro (%)'),
        ('QT_DIA_ATE_PRI_ACESSO', 'Dias ate 1o acesso'),
        ('Y_PROBA_EVADIU', 'Prob. evasao (%)'),
    ]
    for col, label in metrics:
        f_val = zero_both[col].mean()
        a_val = ativos[col].mean()
        delta = f_val - a_val
        print(f"  {label:<43} {f_val:>12.1f} {a_val:>12.1f} {delta:>+10.1f}")
    
    # CALOURO analysis
    print(f"\n--- ANALISE POR TIPO DE ALUNO ---")
    print(df['NM_TIPO_ALUNO'].value_counts().to_string())
    
    calouros = df[df['NM_TIPO_ALUNO'] == 'CALOURO']
    print(f"\nTotal calouros: {len(calouros)}")
    calouros_fantasma = calouros[(calouros['PC_DESEMP_PROVA'] == 0) & (calouros['PC_ATIVIDADE_ENTREGUE'] == 0)]
    print(f"Calouros fantasmas (prova=0, atividade=0): {len(calouros_fantasma)} ({len(calouros_fantasma)/len(calouros)*100:.1f}%)")
    
    # Top 6 features
    print(f"\n--- TOP 6 FEATURES DO MODELO (COLUNAS DE IMPORTANCIA) ---")
    feat_cols = ['NM_TOP1_FEATURE', 'DS_TOP1_FEATURE', 'NM_TOP2_FEATURE', 'DS_TOP2_FEATURE', 'NM_TOP3_FEATURE', 'DS_TOP3_FEATURE']
    for col in feat_cols:
        if col in df.columns:
            print(f"\n{col}:")
            print(df[col].value_counts().head(5).to_string())

    # Quartiles of PC_DESEMP_PROVA
    print(f"\n--- DISTRIBUICAO DE PC_DESEMP_PROVA ---")
    bins = [0, 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    labels_b = ['0 (zero)', '1-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100']
    df['faixa_prova'] = pd.cut(df['PC_DESEMP_PROVA'], bins=[-1]+bins, labels=['0 (zero)']+labels_b[1:])
    print(df['faixa_prova'].value_counts().sort_index().to_string())

if __name__ == "__main__":
    main()
