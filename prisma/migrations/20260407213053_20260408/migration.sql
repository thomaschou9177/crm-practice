-- DropForeignKey
ALTER TABLE "customer_info" DROP CONSTRAINT "customer_info_id_fkey";

-- AlterTable
ALTER TABLE "customer" ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "customer_id_seq";

-- AddForeignKey
ALTER TABLE "customer_info" ADD CONSTRAINT "customer_info_id_fkey" FOREIGN KEY ("id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
