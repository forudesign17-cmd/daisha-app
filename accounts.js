/* ログインできる店舗の一覧（お試し・デモ用）
 * パスワードそのものは書かず、ハッシュ（SHA-256）だけを置きます。
 * 追加・変更は tools/add_account.py を使います（README.md を参照）。
 * sample: true の店舗は、最初にデモ用のサンプルデータが入ります。 */
window.ACCOUNTS = [
  { shop: "demo", name: "デモ店", sample: true, hash: "866b7b3dd64a01733390b32ca7d15768ee727b8a7b325b3a61403eb6f2760826" },
];
