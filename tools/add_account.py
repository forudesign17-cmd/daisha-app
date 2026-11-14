#!/usr/bin/env python3
"""店舗アカウントを accounts.js に追加（または上書き）する。

使い方:
  python3 tools/add_account.py <店舗ID> <表示名> [パスワード] [--sample]

  - 店舗ID: 半角英数字とハイフン（小文字に統一されます）
  - パスワードを省略すると、ランダムな16文字を作ります
  - --sample を付けると、最初にデモ用のサンプルデータ（20台）が入ります
  - パスワードは画面に表示せず、「アカウント控え.md」（Gitに入りません）に書き出します
"""
import hashlib
import os
import re
import secrets
import string
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACCOUNTS = os.path.join(ROOT, 'accounts.js')
MEMO = os.path.join(ROOT, 'アカウント控え.md')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sample = '--sample' in sys.argv
    if len(args) < 2:
        print(__doc__)
        sys.exit(1)
    shop = args[0].strip().lower()
    name = args[1].strip()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,30}', shop):
        sys.exit('店舗IDは半角英数字とハイフンで、2〜31文字にしてください')
    if '"' in name or '\\' in name:
        sys.exit('表示名に " や \\ は使えません')
    alphabet = ''.join(c for c in string.ascii_letters + string.digits if c not in 'l1IO0o')
    password = args[2] if len(args) > 2 else ''.join(secrets.choice(alphabet) for _ in range(16))
    digest = hashlib.sha256(f'daisha|{shop}|{password}'.encode('utf-8')).hexdigest()
    line = f'  {{ shop: "{shop}", name: "{name}", sample: {"true" if sample else "false"}, hash: "{digest}" }},\n'

    with open(ACCOUNTS, encoding='utf-8') as f:
        text = f.read()
    text = re.sub(r'^\s*\{ shop: "%s".*\n' % re.escape(shop), '', text, flags=re.M)
    idx = text.rindex('];')
    text = text[:idx] + line + text[idx:]
    with open(ACCOUNTS, 'w', encoding='utf-8') as f:
        f.write(text)

    new = not os.path.exists(MEMO)
    with open(MEMO, 'a', encoding='utf-8') as f:
        if new:
            f.write('# アカウント控え（このファイルはGitに入りません。人に渡すとき以外は他に出さないでください）\n\n')
        f.write(f'- {datetime.now():%Y-%m-%d %H:%M}  店舗ID: `{shop}` / 表示名: {name} / パスワード: `{password}` / サンプル: {"あり" if sample else "なし"}\n')
    print(f'追加しました: {shop}（{name}）。パスワードは アカウント控え.md に書きました。')


if __name__ == '__main__':
    main()
