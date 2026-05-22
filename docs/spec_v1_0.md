# token-board (ごほうびトークン) 仕様書 v1_0
## ゴール
トークン(★)を貯めて目標数でごほうびと交換する、ABAトークンエコノミー方式のごほうび表Chrome拡張。発達特性児・保護者向け。
## 絶対制約
外部API・通信なし/chrome.storage.localのみ/権限storageのみ/MV3・TS・Vite/UIはpopup内で完結。医療・診断をうたわない。
## 機能
ごほうびゴール(名前/絵文字/必要トークン数)を保護者がCRUD/トークン付与・取り消し/台紙に貯まり表示・目標到達で交換演出/複数ゴール切替/保護者・子供モードを簡易PINで保護/起動時復元/i18n ja-en/無料はゴール1つ、Premium($3買い切り7日トライアル,Stripe Checkout)で無制限+交換履歴。
## 完了条件
npm run build成功・dist生成・_locales ja/en・icons16/48/128・release/token-board.zip生成。
