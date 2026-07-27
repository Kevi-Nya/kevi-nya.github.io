-- ============================================================
-- kevi_nya - 数据库 Schema
-- PostgreSQL
-- ============================================================

-- -------------------- About Me 兴趣标签 --------------------
CREATE TABLE IF NOT EXISTS about_tags (
    id          SERIAL PRIMARY KEY,
    emoji       TEXT NOT NULL,
    label       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- -------------------- My Life 生活卡片 --------------------
CREATE TABLE IF NOT EXISTS life_cards (
    id          SERIAL PRIMARY KEY,
    emoji       TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- -------------------- Little Notes 小笔记 --------------------
CREATE TABLE IF NOT EXISTS little_notes (
    id          SERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    note_date   DATE NOT NULL,
    mood        TEXT,               -- 心情 emoji（如 😺 😌 ✨）
    tags        TEXT[],             -- 旧版标签数组（保留兼容）
    tag_1       TEXT,               -- AI/手动标签 1（可为 NULL）
    tag_2       TEXT,               -- AI/手动标签 2（可为 NULL）
    sort_order  INTEGER NOT NULL DEFAULT 0
);

COMMENT ON COLUMN little_notes.tag_1 IS 'AI 自动生成或手动指定的标签 1，优先级高于 tags 数组';
COMMENT ON COLUMN little_notes.tag_2 IS 'AI 自动生成或手动指定的标签 2，优先级高于 tags 数组';

-- -------------------- Thoughts 思考/随笔 --------------------
CREATE TABLE IF NOT EXISTS thoughts (
    id            SERIAL PRIMARY KEY,
    title         TEXT NOT NULL,
    summary       TEXT NOT NULL,
    tag_type      TEXT,             -- 主标签类型（essay / tech / life）
    tag_label     TEXT,             -- 主标签显示名
    tags          TEXT[],           -- 旧版标签数组（保留兼容）
    tag_1         TEXT,             -- AI/手动标签 1（可为 NULL）
    tag_2         TEXT,             -- AI/手动标签 2（可为 NULL）
    thought_date  DATE NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

COMMENT ON COLUMN thoughts.tag_1 IS 'AI 自动生成或手动指定的标签 1，优先级高于 tags 数组';
COMMENT ON COLUMN thoughts.tag_2 IS 'AI 自动生成或手动指定的标签 2，优先级高于 tags 数组';

-- -------------------- Skills 技能标签 --------------------
CREATE TABLE IF NOT EXISTS skills (
    id          SERIAL PRIMARY KEY,
    emoji       TEXT NOT NULL,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- -------------------- Links 社交链接 --------------------
CREATE TABLE IF NOT EXISTS links (
    id          SERIAL PRIMARY KEY,
    platform    TEXT NOT NULL,
    url         TEXT NOT NULL,
    icon_class  TEXT NOT NULL,
    qq_number   TEXT,               -- QQ 号（仅 QQ 链接使用）
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 迁移语句（如果表已存在，仅添加新字段）
-- ============================================================

-- 为 little_notes 添加 tag_1 / tag_2（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'little_notes' AND column_name = 'tag_1'
    ) THEN
        ALTER TABLE little_notes ADD COLUMN tag_1 TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'little_notes' AND column_name = 'tag_2'
    ) THEN
        ALTER TABLE little_notes ADD COLUMN tag_2 TEXT;
    END IF;
END $$;

-- 为 thoughts 添加 tag_1 / tag_2（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'thoughts' AND column_name = 'tag_1'
    ) THEN
        ALTER TABLE thoughts ADD COLUMN tag_1 TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'thoughts' AND column_name = 'tag_2'
    ) THEN
        ALTER TABLE thoughts ADD COLUMN tag_2 TEXT;
    END IF;
END $$;
