-- Poblar user_roles.resourceId con el commerce.id correspondiente
-- para usuarios legacy que tienen resourceId = NULL
-- Solo actualiza roles OWNER cuyo owner_id coincida con commerce.owner_id

UPDATE user_roles
SET resource_id = c.id,
    updated_at = NOW()
FROM commerce c
WHERE user_roles.resource_id IS NULL
  AND user_roles.user_id = c.owner_id
  AND user_roles.role = 'owner'
  AND user_roles.is_active = true;

-- Para roles MANAGER/OPERATOR sin resourceId, intentar asociar
-- al commerce del owner (cuando exista un solo commerce)
UPDATE user_roles
SET resource_id = subq.commerce_id,
    updated_at = NOW()
FROM (
  SELECT ur.id AS role_id, c.id AS commerce_id
  FROM user_roles ur
  JOIN "user" u ON u.id = ur.user_id
  JOIN commerce c ON c.owner_id = u.id
  WHERE ur.resource_id IS NULL
    AND ur.role IN ('manager', 'operator')
    AND ur.is_active = true
) subq
WHERE user_roles.id = subq.role_id;

-- Para roles CUSTOMER sin resourceId, no se les asigna commerce
-- (los customers no pertenecen a un commerce específico)
