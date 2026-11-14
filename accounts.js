/* ログインできる店舗の一覧（お試し・デモ用）
 * パスワードそのものは書かず、ハッシュ（SHA-256）だけを置きます。
 * 追加・変更は tools/add_account.py を使います（README.md を参照）。
 * sample: true の店舗は、最初にデモ用のサンプルデータが入ります。 */
window.ACCOUNTS = [
  { shop: "demo", name: "デモ店", sample: true, hash: "5407c831d8ab39afe74d187e9c72247a669787ca8f3dcd2cac15180db1e013d0" },
];
