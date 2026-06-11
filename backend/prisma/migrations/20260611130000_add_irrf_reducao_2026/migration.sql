-- AlterTable
ALTER TABLE "tabela_irrf_deducoes" ADD COLUMN     "limiteFaixa1" DECIMAL(15,2),
ADD COLUMN     "reducaoMaxima" DECIMAL(15,2),
ADD COLUMN     "limiteFaixa2" DECIMAL(15,2),
ADD COLUMN     "constanteReducao" DECIMAL(15,2),
ADD COLUMN     "coeficienteReducao" DECIMAL(10,6);
