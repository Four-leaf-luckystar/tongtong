CREATE TABLE IF NOT EXISTS memories (
    scope TEXT NOT NULL,
    id TEXT NOT NULL,
    binding_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (scope, id)
);
CREATE INDEX IF NOT EXISTS memories_scope_updated_idx ON memories(scope, updated_at DESC);
