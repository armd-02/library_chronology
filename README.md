# 図書館年表マップ

日本の図書館の歴史を、地図と年表からたどるウェブサイトです。[Community Map Maker](https://github.com/K-Sakanoshita/community_mapmaker/tree/46e3785c391034b9241f7eeeea8d2f036b0ffd06) をベースにしています。

## ローカルで開く

```sh
python3 -m http.server 8000
```

ブラウザーで http://localhost:8000/ を開きます。背景地図と公開年表を読み込むにはインターネット接続が必要です。

## データと設定

- `data/config-user.jsonc` に地図の初期位置、表示ズーム、連続再生、メニュー、データの接続先を設定します。
- 図書館の位置は `data/japan_library.json` に収録しています。日本国内の `amenity=library` をOverpassから取得し（2026年11月18日 21:41 JST、ODbL）、[国立国会図書館のISIL管理台帳](https://www.ndl.go.jp/library/isil) と照合しています。
- OSM上の位置や形状が確認できた公共図書館7件は、サイト用に `amenity=library` と `ref:isil` を補っています（`isil_library_supplements`）。平塚市南図書館は[公式の再開案内](https://www.lib.city.hiratsuka.kanagawa.jp/viewer/info.html?g=20&id=127)を確認して追加しています。同一施設と確認した重複は一つの形状にまとめ、年表から参照されていない大学・学校の図書館は除外しました。
- OSM IDを変更した施設は旧リンクを解決できるようにしています（`chronology_osm_aliases`）。石川県立図書館の旧館は移転前の年表の位置を保つため、2021年10月1日の形状を保持しています（`chronology_historical_osm`）。
- 年表（CC0）はコミュニティマップメーカーのバックエンドの `library_chronology` プロジェクトから読み取ります。移行元の `yyyy`、`mm`、`dd` を組み合わせ、月日が不明な箇所は `--` と表示します。寒川文書館は寒川総合図書館、国立文化財機構は東京国立博物館の位置に紐づいています。東京国立博物館の敷地形状も静的ファイルに収録しています。
- `data/listtable.jsonc` が年表の一覧表示、`data/config-activities.jsonc` が詳細項目、`data/glot-custom.jsonc` が日本語・英語のサイト独自文言を定義しています。
- 初期背景地図は、OSMFJ のベクトル地図スタイル `tiles/osmfj_nopoi.json` を旧サイトの反転・グレースケール配色に調整した `tiles/osmfj_nopoi_dark.json` です。サイトへの投稿・編集は無効です。
