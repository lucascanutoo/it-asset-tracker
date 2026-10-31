CREATE TABLE IF NOT EXISTS maquinas (
  id_maquina INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_maquina TEXT NOT NULL COLLATE NOCASE UNIQUE,
  tipo_maquina TEXT NOT NULL,
  usuario TEXT,
  setor TEXT,
  sistema_operacional TEXT,
  tipo_aquisicao TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL
);
