UPDATE `Product`
SET `brand` = 'SK Perfumes'
WHERE `brand` = 'ESSENCE';

ALTER TABLE `Product`
ALTER COLUMN `brand` SET DEFAULT 'SK Perfumes';
