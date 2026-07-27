#!/usr/bin/env python3
"""
kevi_nya - 数据导出工具
从 PostgreSQL 数据库中读取内容数据，导出为 JSON 供静态网站使用。

用法:
    python3 tools/export.py              # 导出到默认路径 data.json
    python3 tools/export.py -o out.json  # 导出到指定路径
"""

import json
import os
import sys
from datetime import date

import psycopg2
import psycopg2.extras


# 数据库连接配置
DB_CONFIG = {
    "dbname": "kevi_nya",
    "host": "localhost",
}

# 默认输出文件路径（项目根目录）
DEFAULT_OUTPUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data.json")


def get_connection():
    """建立并返回数据库连接。"""
    return psycopg2.connect(**DB_CONFIG)


def export_data(conn):
    """从数据库查询所有内容数据并返回字典。"""
    data = {}

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # About Me 兴趣标签
        cur.execute("SELECT emoji, label FROM about_tags ORDER BY sort_order")
        data["about_tags"] = cur.fetchall()

        # My Life 生活卡片
        cur.execute("SELECT emoji, title, description FROM life_cards ORDER BY sort_order")
        data["life_cards"] = cur.fetchall()

        # Little Notes
        cur.execute("SELECT content, note_date FROM little_notes ORDER BY sort_order")
        rows = cur.fetchall()
        # 将 date 对象转为字符串
        for row in rows:
            if isinstance(row["note_date"], date):
                row["note_date"] = row["note_date"].strftime("%Y.%m.%d")
        data["little_notes"] = rows

        # Thoughts 思考/随笔
        cur.execute(
            "SELECT tag_type, tag_label, title, summary, thought_date "
            "FROM thoughts ORDER BY sort_order"
        )
        rows = cur.fetchall()
        for row in rows:
            if isinstance(row["thought_date"], date):
                row["thought_date"] = row["thought_date"].strftime("%Y.%m.%d")
        data["thoughts"] = rows

        # Skills 技能标签
        cur.execute("SELECT emoji, name FROM skills ORDER BY sort_order")
        data["skills"] = cur.fetchall()

        # Links 社交链接
        cur.execute("SELECT platform, url, icon_class FROM links ORDER BY sort_order")
        data["links"] = cur.fetchall()

    return data


def write_json(data, path):
    """将数据写入 JSON 文件。"""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✅ 数据已导出: {path}")
    print(f"   - About Me 标签: {len(data['about_tags'])} 条")
    print(f"   - My Life 卡片: {len(data['life_cards'])} 条")
    print(f"   - Little Notes: {len(data['little_notes'])} 条")
    print(f"   - Thoughts:      {len(data['thoughts'])} 条")
    print(f"   - Skills:        {len(data['skills'])} 条")
    print(f"   - Links:         {len(data['links'])} 条")


def main():
    output_path = DEFAULT_OUTPUT

    # 解析命令行参数
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "-o" and i + 1 < len(args):
            output_path = args[i + 1]
            i += 2
        elif args[i] in ("-h", "--help"):
            print(__doc__)
            return
        else:
            output_path = args[i]
            i += 1

    try:
        conn = get_connection()
        data = export_data(conn)
        conn.close()
    except psycopg2.OperationalError as e:
        print(f"❌ 数据库连接失败: {e}", file=sys.stderr)
        print("   请确保 PostgreSQL 正在运行且 kevi_nya 数据库已创建。", file=sys.stderr)
        sys.exit(1)

    write_json(data, output_path)


if __name__ == "__main__":
    main()
