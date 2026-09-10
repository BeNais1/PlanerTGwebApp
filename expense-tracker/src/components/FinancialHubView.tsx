import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../context/useAuth";
import { useFamilyBudget } from "../context/useFamilyBudget";
import { useCategories } from "../hooks/useCategories";
import { useCurrency, type Currency } from "../hooks/useCurrency";
import { NumericKeypad, getKeypadNumericValue } from "./NumericKeypad";
import {
  getReceiptShare,
  subscribeToAllTransactions,
  subscribeToSavedReceipts,
  subscribeToUserSettings,
  updateTransaction,
  updateUserSettings,
  type DebtItem,
  type ReceiptShare,
  type SavedSharedReceipt,
  type SmartGoal,
  type Transaction,
  type UserSettings,
} from "../services/database";
import { SubscriptionsView } from "./SubscriptionsView";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { deleteSmartGoal } from "../services/database";
import "./FinancialHubView.css";

type HubTab = "goals" | "auto" | "search" | "recurring" | "debts" | "receipts";
type AmountEditor =
  | { kind: "goalTarget"; title: string }
  | { kind: "goalSaved"; title: string }
  | { kind: "goalTopUp"; title: string; goalId: string }
  | { kind: "debt"; title: string };

interface FinancialHubViewProps {
  isActive: boolean;
  walletBalances: Record<string, number>;
  onOpenReceipt: (share: ReceiptShare) => void;
  onOpenTransaction: (transaction: Transaction) => void;
}

const TABS: { id: HubTab; label: string }[] = [
  { id: "goals", label: "Цілі" },
  { id: "auto", label: "Категорії" },
  { id: "search", label: "Пошук" },
  { id: "recurring", label: "Підписки" },
  { id: "debts", label: "Борги" },
  { id: "receipts", label: "Чеки" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ["маркет", "супер", "food", "grocery", "silpo", "atb", "novus", "ашан", "продукт"],
  cafe: ["coffee", "кафе", "kava", "starbucks", "restaurant", "бар", "піца"],
  transport: ["uber", "bolt", "taxi", "метро", "bus", "fuel", "wog", "okko", "парков"],
  home: ["rent", "жкг", "комун", "дім", "інтернет", "internet", "water", "gas"],
  health: ["apteka", "аптека", "doctor", "clinic", "health", "pharma"],
  entertainment: ["cinema", "кіно", "netflix", "spotify", "steam", "playstation"],
  shopping: ["mall", "shop", "store", "amazon", "rozetka", "купів"],
  subscriptions: ["subscription", "підпис", "icloud", "youtube", "chatgpt"],
  education: ["course", "school", "book", "книга", "курс", "освіт"],
};

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseDateInput(value: string) {
  return value ? new Date(`${value}T12:00:00`).getTime() : undefined;
}

function getDefaultCategory(description: string) {
  const text = description.toLowerCase();
  const match = Object.entries(CATEGORY_KEYWORDS).find(([, words]) => words.some((word) => text.includes(word)));
  return match?.[0] || "other";
}

export const FinancialHubView = ({ isActive, onOpenReceipt, onOpenTransaction }: FinancialHubViewProps) => {
  const { user } = useAuth();
  const { activeSpace, dataOwnerId, isFamily } = useFamilyBudget();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS } = useCurrency();
  const { names: categoryNames, icons: categoryIcons } = useCategories();
  const [activeTab, setActiveTab] = useState<HubTab>("goals");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savedReceipts, setSavedReceipts] = useState<SavedSharedReceipt[]>([]);
  const [receiptCache, setReceiptCache] = useState<Record<string, ReceiptShare | null>>({});
  const [settings, setSettings] = useState<UserSettings>({});
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalToDelete, setGoalToDelete] = useState<SmartGoal | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState("");
  const [debtPerson, setDebtPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDate, setDebtDate] = useState("");
  const [debtDirection, setDebtDirection] = useState<DebtItem["direction"]>("owed_to_me");
  const [amountEditor, setAmountEditor] = useState<AmountEditor | null>(null);
  const [keypadValue, setKeypadValue] = useState("");

  useEffect(() => {
    if (!isActive || !user || !dataOwnerId) return;
    const unsubTransactions = subscribeToAllTransactions(dataOwnerId, setTransactions);
    const unsubSettings = subscribeToUserSettings(dataOwnerId, setSettings);
    const unsubSavedReceipts = subscribeToSavedReceipts(user.id, setSavedReceipts);
    return () => {
      unsubTransactions();
      unsubSettings();
      unsubSavedReceipts();
    };
  }, [isActive, user, dataOwnerId]);

  useEffect(() => {
    if (!isActive || savedReceipts.length === 0) {
      return;
    }
    let cancelled = false;
    Promise.all(savedReceipts.map(async (receipt) => [receipt.shareCode, await getReceiptShare(receipt.shareCode)] as const))
      .then((entries) => {
        if (!cancelled) setReceiptCache(Object.fromEntries(entries));
      });
    return () => { cancelled = true; };
  }, [isActive, savedReceipts]);

  const goals = settings.smartGoals || [];
  const debts = settings.debts || [];

  const autoSuggestions = useMemo(() => (
    transactions
      .filter((tx) => !tx.isReconciliation && tx.type === "expense" && tx.description.trim().length > 0)
      .filter((tx) => !isFamily || activeSpace.role !== "member" || tx.authorId === String(user?.id))
      .map((tx) => ({ tx, suggestedCategory: getDefaultCategory(tx.description) }))
      .filter(({ tx, suggestedCategory }) => suggestedCategory !== "other" && suggestedCategory !== tx.category)
      .slice(0, 12)
  ), [activeSpace.role, isFamily, transactions, user?.id]);

  const searchResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (selectedTag && !(tx.tags || []).includes(selectedTag)) return false;
      if (!needle) return true;
      const haystack = `${(tx.tags || []).map(tag => '#' + tag).join(' ')} ${tx.description} ${tx.category} ${categoryNames[tx.category] || ""} ${tx.amount}`.toLowerCase();
      return haystack.includes(needle);
    }).slice(0, 40);
  }, [categoryNames, search, selectedTag, transactions]);

  const totalDebtsToMe = debts.filter((debt) => !debt.isPaid && debt.direction === "owed_to_me")
    .reduce((sum, debt) => sum + convertToMain(debt.amount, (debt.currency || "EUR") as Currency), 0);
  const totalDebtsIOwe = debts.filter((debt) => !debt.isPaid && debt.direction === "i_owe")
    .reduce((sum, debt) => sum + convertToMain(debt.amount, (debt.currency || "EUR") as Currency), 0);

  const saveGoals = async (nextGoals: SmartGoal[]) => {
    if (user && dataOwnerId) await updateUserSettings(dataOwnerId, { smartGoals: nextGoals });
  };

  const saveDebts = async (nextDebts: DebtItem[]) => {
    if (user && dataOwnerId) await updateUserSettings(dataOwnerId, { debts: nextDebts });
  };

  const openAmountEditor = (editor: AmountEditor, initialValue = "") => {
    setAmountEditor(editor);
    setKeypadValue(initialValue);
  };

  const handleAmountSubmit = async () => {
    if (!amountEditor) return;
    const amount = getKeypadNumericValue(keypadValue);
    if (amount <= 0) return;

    if (amountEditor.kind === "goalTarget") setGoalTarget(String(amount));
    if (amountEditor.kind === "goalSaved") setGoalSaved(String(amount));
    if (amountEditor.kind === "debt") setDebtAmount(String(amount));
    if (amountEditor.kind === "goalTopUp") {
      await saveGoals(goals.map((goal) => (
        goal.id === amountEditor.goalId
          ? { ...goal, savedAmount: Math.min(goal.targetAmount, goal.savedAmount + amount) }
          : goal
      )));
    }

    setAmountEditor(null);
    setKeypadValue("");
  };

  const handleAddGoal = async () => {
    if (!goalTitle.trim() || !goalTarget || !user) return;
    const targetAmount = Number(goalTarget);
    const savedAmount = Number(goalSaved) || 0;
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return;
    const id = makeId("goal");
    await saveGoals([
      {
        id,
        title: goalTitle.trim(),
        targetAmount,
        savedAmount: Math.min(savedAmount, targetAmount),
        currency: mainCurrency,
        dueDate: parseDateInput(goalDate),
        createdAt: Number(id.split("_")[1]),
      },
      ...goals,
    ]);
    setGoalTitle("");
    setGoalTarget("");
    setGoalSaved("");
    setGoalDate("");
  };

  const handleAddDebt = async () => {
    if (!debtPerson.trim() || !debtAmount || !user) return;
    const amount = Number(debtAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const id = makeId("debt");
    await saveDebts([
      {
        id,
        person: debtPerson.trim(),
        amount,
        currency: mainCurrency,
        direction: debtDirection,
        dueDate: parseDateInput(debtDate),
        isPaid: false,
        createdAt: Number(id.split("_")[1]),
      },
      ...debts,
    ]);
    setDebtPerson("");
    setDebtAmount("");
    setDebtDate("");
  };

  const handleApplyCategory = async (tx: Transaction, category: string) => {
    if (!user || !tx.id) return;
    if (isFamily && activeSpace.role === "member" && tx.authorId !== String(user.id)) return;
    await updateTransaction(dataOwnerId, tx.id, { category });
  };

  if (!isActive) return null;

  return (
    <div className="financial-hub">
      <div className="financial-hub-header">
        <div>
          <h2>Фінанси</h2>
          
        </div>
        <select className="hub-section-select" aria-label="Розділ фінансів" value={activeTab} onChange={event => setActiveTab(event.target.value as HubTab)}>
          {TABS.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </select>
      </div>

      {activeTab === "goals" && (
        <section className="hub-section">
          <details className="minimal-disclosure"><summary>Додати</summary><HubForm>
            <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Назва цілі" />
            <div className="hub-form-grid">
              <AmountButton label="Сума цілі" value={goalTarget ? formatValue(Number(goalTarget), mainCurrency) : "Обрати суму"} onClick={() => openAmountEditor({ kind: "goalTarget", title: "Сума цілі" }, goalTarget)} />
              <AmountButton label="Вже накопичено" value={goalSaved ? formatValue(Number(goalSaved), mainCurrency) : "0"} onClick={() => openAmountEditor({ kind: "goalSaved", title: "Вже накопичено" }, goalSaved)} />
            </div>
            <div className="hub-form-grid">
              <DateField label="Дата цілі" value={goalDate} onChange={setGoalDate} emptyText="Оберіть дату" />
              <button onClick={handleAddGoal}>Додати ціль</button>
            </div>
          </HubForm></details>

          <div className="hub-list">
            {goals.length === 0 ? <EmptyState text="Цілей поки немає" /> : goals.map((goal) => {
              const percent = Math.min(100, (goal.savedAmount / goal.targetAmount) * 100);
              return (
                <div key={goal.id} className="hub-card goal-card">
                  <div className="hub-row">
                    <div>
                      <strong>{goal.title}</strong>
                      <small>{goal.dueDate ? new Date(goal.dueDate).toLocaleDateString("uk-UA") : "Без дати"}</small>
                    </div>
                    <b>{percent.toFixed(0)}%</b>
                  </div>
                  <div className="hub-progress"><span style={{ width: `${percent}%` }} /></div>
                  <div className="goal-money-row">
                    <span>{formatValue(goal.savedAmount, goal.currency as Currency)}</span>
                    <small>з {formatValue(goal.targetAmount, goal.currency as Currency)}</small>
                  </div>
                  <div className="hub-row compact">
                    <button onClick={() => openAmountEditor({ kind: "goalTopUp", title: `Поповнити: ${goal.title}`, goalId: goal.id })}>Поповнити</button>
                    <button onClick={() => setGoalToDelete(goal)}>Видалити</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "auto" && (
        <section className="hub-section">
          <div className="hub-info-card">
            <strong>Категорії</strong>
            <span>
              Натисніть, щоб застосувати категорію.
            </span>
          </div>
          <SummaryCard title="Знайдено підказок" value={`${autoSuggestions.length}`} detail="на основі описів в історії" />
          <div className="hub-list">
            {autoSuggestions.length === 0 ? <EmptyState text="Нових пропозицій немає" /> : autoSuggestions.map(({ tx, suggestedCategory }) => (
              <button key={tx.id} className="hub-card clickable" onClick={() => handleApplyCategory(tx, suggestedCategory)}>
                <div className="hub-row">
                  <div>
                    <strong>{tx.description}</strong>
                    <small>{categoryNames[tx.category] || tx.category} → {categoryNames[suggestedCategory] || suggestedCategory}</small>
                  </div>
                  <b>{categoryIcons[suggestedCategory] || ""}</b>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "search" && (
        <section className="hub-section">
          <div className="tag-list" aria-label="Фільтр за тегом"><button className={!selectedTag ? 'active' : ''} onClick={() => setSelectedTag('')}>Усі</button>{[...new Set(transactions.flatMap(tx => tx.tags || []))].sort().map(tag => <button key={tag} className={selectedTag === tag ? 'active' : ''} aria-pressed={selectedTag === tag} onClick={() => setSelectedTag(tag)}>#{tag}</button>)}</div>
          <input className="hub-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пошук або #тег" />
          <div className="hub-list">
            {searchResults.map((tx) => (
              <button key={tx.id} className="hub-card clickable slim" onClick={() => onOpenTransaction(tx)}>
                <div className="hub-row">
                  <div>
                    <strong>{tx.description || categoryNames[tx.category] || "Операція"}</strong>
                    <small>{new Date(tx.date).toLocaleDateString("uk-UA")} · {categoryNames[tx.category] || tx.category}</small>
                  </div>
                  <b className={tx.type === "income" ? "positive" : "negative"}>{tx.type === "expense" ? "-" : "+"}{formatValue(tx.amount, (tx.currency || mainCurrency) as Currency)}</b>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "recurring" && (
        <SubscriptionsView isActive={true} />
      )}

      {activeTab === "debts" && (
        <section className="hub-section">
          <div className="hub-summary-grid">
            <SummaryCard title="Мені винні" value={formatValue(totalDebtsToMe)} detail="активні борги" />
            <SummaryCard title="Я винен" value={formatValue(totalDebtsIOwe)} detail="до оплати" />
          </div>
          <details className="minimal-disclosure"><summary>Додати</summary><HubForm>
            <input value={debtPerson} onChange={(event) => setDebtPerson(event.target.value)} placeholder="Хто" />
            <div className="hub-form-grid">
              <AmountButton label="Сума боргу" value={debtAmount ? formatValue(Number(debtAmount), mainCurrency) : "Обрати суму"} onClick={() => openAmountEditor({ kind: "debt", title: "Сума боргу" }, debtAmount)} />
              <select value={debtDirection} onChange={(event) => setDebtDirection(event.target.value as DebtItem["direction"])}>
                <option value="owed_to_me">Мені винні</option>
                <option value="i_owe">Я винен</option>
              </select>
            </div>
            <div className="hub-form-grid">
              <DateField label="Дата повернення" value={debtDate} onChange={setDebtDate} emptyText="Оберіть дату" />
              <button onClick={handleAddDebt}>Додати борг</button>
            </div>
          </HubForm></details>
          <div className="hub-list">
            {debts.length === 0 ? <EmptyState text="Боргів поки немає" /> : debts.map((debt) => (
              <div key={debt.id} className={`hub-card slim ${debt.isPaid ? "muted" : ""}`}>
                <div className="hub-row">
                  <div><strong>{debt.person}</strong><small>{debt.direction === "owed_to_me" ? "винен вам" : "ви винні"} · {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString("uk-UA") : "без дати"}</small></div>
                  <b>{formatValue(debt.amount, debt.currency as Currency)}</b>
                </div>
                <div className="hub-row compact">
                  <button onClick={() => saveDebts(debts.map((item) => item.id === debt.id ? { ...item, isPaid: !item.isPaid } : item))}>{debt.isPaid ? "Повернути" : "Закрити"}</button>
                  <button onClick={() => saveDebts(debts.filter((item) => item.id !== debt.id))}>Видалити</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "receipts" && (
        <section className="hub-section">
          <SummaryCard title="Спільні чеки" value={`${savedReceipts.length}`} detail="збережених чеків" />
          <div className="hub-list">
            {savedReceipts.length === 0 ? <EmptyState text="Збережених спільних чеків поки немає" /> : savedReceipts.map((receipt) => {
              const share = receiptCache[receipt.shareCode];
              const tx = share?.transaction;
              return (
                <button key={receipt.shareCode} className="hub-card clickable slim" disabled={!share} onClick={() => share && onOpenReceipt(share)}>
                  <div className="hub-row">
                    <div>
                      <strong>{tx ? categoryNames[tx.category] || "Чек" : "Завантаження чека"}</strong>
                      <small>{new Date(receipt.savedAt).toLocaleDateString("uk-UA")} · {receipt.shareCode}</small>
                    </div>
                    <b>{tx ? formatValue(tx.amount, (tx.currency || mainCurrency) as Currency) : ""}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {goalToDelete && (
        <ConfirmDeleteDialog
          title={`Видалити ціль «${goalToDelete.title}»?`}
          description="Буде видалено лише цю ціль. Баланси гаманців залишаться без змін."
          onConfirm={async () => {
            if (!user || !dataOwnerId) throw new Error('Account unavailable');
            await deleteSmartGoal(dataOwnerId, goalToDelete.id);
          }}
          onClose={() => setGoalToDelete(null)}
        />
      )}
      {amountEditor && (
        <AmountKeypadSheet
          title={amountEditor.title}
          value={keypadValue}
          onChange={setKeypadValue}
          currencySymbol={CURRENCY_SYMBOLS[mainCurrency]}
          submitLabel={amountEditor.kind === "goalTopUp" ? "Поповнити" : "Готово"}
          onSubmit={handleAmountSubmit}
          onClose={() => {
            setAmountEditor(null);
            setKeypadValue("");
          }}
        />
      )}
    </div>
  );
};

function HubForm({ children }: { children: ReactNode }) {
  return <div className="hub-form">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="hub-empty">{text}</div>;
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="hub-summary-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AmountButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button className="hub-amount-btn" type="button" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function DateField({ label, value, emptyText, onChange }: { label: string; value: string; emptyText: string; onChange: (value: string) => void }) {
  return (
    <label className="hub-date-field">
      <span>{label}</span>
      <strong>{value ? new Date(`${value}T12:00:00`).toLocaleDateString("uk-UA") : emptyText}</strong>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AmountKeypadSheet({
  title,
  value,
  onChange,
  currencySymbol,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  currencySymbol: string;
  submitLabel: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="hub-keypad-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="hub-keypad-sheet">
        <div className="hub-keypad-header">
          <strong>{title}</strong>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <NumericKeypad
          value={value}
          onChange={onChange}
          currencySymbol={currencySymbol}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
        />
      </div>
    </div>
  );
}
