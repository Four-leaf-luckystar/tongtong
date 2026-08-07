CREATE TABLE IF NOT EXISTS public.tonghuaji_memories (
    owner_id UUID NOT NULL DEFAULT auth.uid(),
    id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    binding_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    tier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    content TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, id)
);

ALTER TABLE public.tonghuaji_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own memories"
ON public.tonghuaji_memories
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS tonghuaji_memories_owner_scope_idx
ON public.tonghuaji_memories(owner_id, user_id, updated_at DESC);
