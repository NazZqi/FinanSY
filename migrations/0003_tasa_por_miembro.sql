-- El interés de la cuenta de ahorro es de cada persona: cada una guarda su plata en su banco.
-- Lo único compartido del jarrón es el total.
alter table finansy.jar_members
  add column savings_rate_bp integer not null default 0 check (savings_rate_bp between 0 and 10000);

-- La tasa que se puso al crear el jarrón era la de quien lo creó.
update finansy.jar_members m
set savings_rate_bp = j.savings_rate_bp
from finansy.jars j
where m.jar_id = j.id and m.user_id = j.owner_id;

-- jars.savings_rate_bp queda sin uso, pero se conserva para poder volver a la imagen anterior.
