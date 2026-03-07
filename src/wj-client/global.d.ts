import common from './messages/en/common.json';
import nav from './messages/en/nav.json';
import auth from './messages/en/auth.json';
import transaction from './messages/en/transaction.json';
import wallet from './messages/en/wallet.json';
import investment from './messages/en/investment.json';
import budget from './messages/en/budget.json';
import report from './messages/en/report.json';
import importMsgs from './messages/en/import.json';
import settings from './messages/en/settings.json';
import ui from './messages/en/ui.json';

type Messages = typeof common &
  typeof nav &
  typeof auth &
  typeof transaction &
  typeof wallet &
  typeof investment &
  typeof budget &
  typeof report &
  typeof importMsgs &
  typeof settings &
  typeof ui;

declare global {
  // Use type safe message keys with `next-intl`
  interface IntlMessages extends Messages {}
}
