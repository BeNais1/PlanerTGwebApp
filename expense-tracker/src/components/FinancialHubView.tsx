import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../hooks/useCategories";
import { useCurrency, type Currency } from "../hooks/useCurrency";
import { NumericKeypad, getKeypadNumericValue } from "./NumericKeypad";
import {
  getReceiptShare,
  subscribeToAllTransactions,
  subscribeToSavedReceipts,
  subscribeToSubscriptions,
  subscribeToUserSettings,
  updateTransaction,
  updateUserSettings,
  type DebtItem,
  type ReceiptShare,
  type SavedSharedReceipt,
  type SmartGoal,
  type Subscription,
  type Transaction,
  type UserSettings,
} from "../services/database";
import "./FinancialHubView.css";

type HubTab = "goals" | "auto" | "calendar" | "plan" | "search" | "recurring" | "debts" | "receipts";
type AmountEditor =
  | { kind: "goalTarget"; title: string }
  | { kind: "goalSaved"; title: string }
  | { kind: "goalTopUp"; title: string; goalId: string }
  | { kind: "plan"; title: string }
  | { kind: "debt"; title: string };

interface FinancialHubViewProps {
  isActive: boolean;
  walletBalances: Record<string, number>;
  onOpenReceipt: (share: ReceiptShare) => void;
  onOpenTransaction: (transaction: Transaction) => void;
}

const TABS: { id: HubTab; label: string }[] = [
  { id: "goals", label: "Цілі" },
  { id: "auto", label: "Авто" },
  { id: "calendar", label: "Календар" },
  { id: "plan", label: "План" },
  { id: "search", label: "Пошук" },
  { id: "recurring", label: "Повтори" },
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

function monthKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultCategory(description: string) {
  const text = description.toLowerCase();
  const match = Object.entries(CATEGORY_KEYWORDS).find(([, words]) => words.some((word) => text.includes(word)));
  return match?.[0] || "other";
}

export const FinancialHubView = ({ isActive, walletBalances, onOpenReceipt, onOpenTransaction }: FinancialHubViewProps) => {
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS } = useCurrency();
  const { names: categoryNames, icons: categoryIcons, categories } = useCategories();
  const [activeTab, setActiveTab] = useState<HubTab>("goals");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [savedReceipts, setSavedReceipts] = useState<SavedSharedReceipt[]>([]);
  const [receiptCache, setReceiptCache] = useState<Record<string, ReceiptShare | null>>({});
  const [settings, setSettings] = useState<UserSettings>({});
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [search, setSearch] = useState("");
  const [debtPerson, setDebtPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDate, setDebtDate] = useState("");
  const [debtDirection, setDebtDirection] = useState<DebtItem["direction"]>("owed_to_me");
  const [amountEditor, setAmountEditor] = useState<AmountEditor | null>(null);
  const [keypadValue, setKeypadValue] = useState("");

  useEffect(() => {
    if (!isActive || !user) return;
    const unsubTransactions = subscribeToAllTransactions(user.id, setTransactions);
    const unsubSettings = subscribeToUserSettings(user.id, setSettings);
    const unsubSubscriptions = subscribeToSubscriptions(user.id, setSubscriptions);
    const unsubSavedReceipts = subscribeToSavedReceipts(user.id, setSavedReceipts);
    return () => {
      unsubTransactions();
      unsubSettings();
      unsubSubscriptions();
      unsubSavedReceipts();
    };
  }, [isActive, user]);

  useEffect(() => {
    if (!isActive || savedReceipts.length === 0) {
      setReceiptCache({});
      return;
    }
    let cancelled = false;
    Promise.all(savedReceipts.map(async (receipt) => [receipt.shareCode, await getReceiptShare(receipt.shareCode)] as const))
      .then((entries) => {
        if (!cancelled) setReceiptCache(Object.fromEntries(entries));
      });
    return () => { cancelled = true; };
  }, [isActive, savedReceipts]);

  useEffect(() => {
    if (settings.monthlyPlanAmount) setPlanAmount(String(settings.monthlyPlanAmount));
  }, [settings.monthlyPlanAmount]);

  const goals = settings.smartGoals || [];
  const debts = settings.debts || [];
  const now = Date.now();
  const currentMonth = monthKey(now);

  const monthTransactions = useMemo(
    () => transactions.filter((tx) => monthKey(tx.date) === currentMonth),
    [currentMonth, transactions]
  );

  const monthExpenses = useMemo(
    () => monthTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + convertToMain(tx.amount, (tx.currency || "EUR") as Currency), 0),
    [convertToMain, monthTransactions]
  );

  const autoSuggestions = useMemo(() => (
    transactions
      .filter((tx) => tx.type === "expense" && tx.description.trim().length > 0)
      .map((tx) => ({ tx, suggestedCategory: getDefaultCategory(tx.description) }))
      .filter(({ tx, suggestedCategory }) => suggestedCategory !== "other" && suggestedCategory !== tx.category)
      .slice(0, 12)
  ), [transactions]);

  const calendarItems = useMemo(() => {
    const txItems = transactions.slice(0, 20).map((tx) => ({
      id: `tx-${tx.id}`,
      date: tx.date,
      title: tx.type === "income" ? "Дохід" : categoryNames[tx.category] || "Витрата",
      amount: tx.type === "expense" ? -convertToMain(tx.amount, (tx.currency || "EUR") as Currency) : convertToMain(tx.amount, (tx.currency || "EUR") as Currency),
      kind: "Операція",
    }));
    const subItems = subscriptions.filter((sub) => sub.isActive).map((sub) => ({
      id: `sub-${sub.id}`,
      date: sub.nextDate,
      title: sub.name,
      amount: -convertToMain(sub.amount, (sub.currency || "EUR") as Currency),
      kind: "Повтор",
    }));
    const debtItems = debts.filter((debt) => !debt.isPaid && debt.dueDate).map((debt) => ({
      id: `debt-${debt.id}`,
      date: debt.dueDate || now,
      title: debt.person,
      amount: debt.direction === "owed_to_me" ? convertToMain(debt.amount, (debt.currency || "EUR") as Currency) : -convertToMain(debt.amount, (debt.currency || "EUR") as Currency),
      kind: "Борг",
    }));
    return [...subItems, ...debtItems, ...txItems].sort((a, b) => a.date - b.date).slice(0, 30);
  }, [categoryNames, convertToMain, debts, now, subscriptions, transactions]);

  const searchResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return transactions.slice(0, 20);
    return transactions.filter((tx) => {
      const haystack = `${tx.description} ${tx.category} ${categoryNames[tx.category] || ""} ${tx.amount}`.toLowerCase();
      return haystack.includes(needle);
    }).slice(0, 40);
  }, [categoryNames, search, transactions]);

  const monthlyPlanAmount = settings.monthlyPlanAmount || 0;
  const planProgress = monthlyPlanAmount > 0 ? Math.min(100, (monthExpenses / monthlyPlanAmount) * 100) : 0;
  const upcomingSubscriptions = subscriptions.filter((sub) => sub.isActive).slice(0, 8);
  const totalDebtsToMe = debts.filter((debt) => !debt.isPaid && debt.direction === "owed_to_me")
    .reduce((sum, debt) => sum + convertToMain(debt.amount, (debt.currency || "EUR") as Currency), 0);
  const totalDebtsIOwe = debts.filter((debt) => !debt.isPaid && debt.direction === "i_owe")
    .reduce((sum, debt) => sum + convertToMain(debt.amount, (debt.currency || "EUR") as Currency), 0);

  if (!isActive) return null;

  const saveGoals = async (nextGoals: SmartGoal[]) => {
    if (user) await updateUserSettings(user.id, { smartGoals: nextGoals });
  };

  const saveDebts = async (nextDebts: DebtItem[]) => {
    if (user) await updateUserSettings(user.id, { debts: nextDebts });
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
    if (amountEditor.kind === "plan") setPlanAmount(String(amount));
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
    await saveGoals([
      {
        id: makeId("goal"),
        title: goalTitle.trim(),
        targetAmount,
        savedAmount: Math.min(savedAmount, targetAmount),
        currency: mainCurrency,
        dueDate: parseDateInput(goalDate),
        createdAt: Date.now(),
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
    await saveDebts([
      {
        id: makeId("debt"),
        person: debtPerson.trim(),
        amount,
        currency: mainCurrency,
        direction: debtDirection,
        dueDate: parseDateInput(debtDate),
        isPaid: false,
        createdAt: Date.now(),
      },
      ...debts,
    ]);
    setDebtPerson("");
    setDebtAmount("");
    setDebtDate("");
  };

  const handleSavePlan = async () => {
    if (!user) return;
    const amount = Number(planAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    await updateUserSettings(user.id, { monthlyPlanAmount: amount, monthlyPlanCurrency: mainCurrency });
  };

  const handleApplyCategory = async (tx: Transaction, category: string) => {
    if (!user || !tx.id) return;
    await updateTransaction(user.id, tx.id, { category });
  };

  return (
    <div className="financial-hub">
      <div className="financial-hub-header">
        <div>
          <h2>Фінанси</h2>
          <p>Цілі, планування, борги та історія в одному місці</p>
        </div>
        <span>{Object.keys(walletBalances).length} гаман.</span>
      </div>

      <div className="financial-hub-tabs">
        {TABS.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "goals" && (
        <section className="hub-section">
          <HubForm>
            <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Назва цілі" />
            <div className="hub-form-grid">
              <AmountButton label="Сума цілі" value={goalTarget ? formatValue(Number(goalTarget), mainCurrency) : "Обрати суму"} onClick={() => openAmountEditor({ kind: "goalTarget", title: "Сума цілі" }, goalTarget)} />
              <AmountButton label="Вже накопичено" value={goalSaved ? formatValue(Number(goalSaved), mainCurrency) : "0"} onClick={() => openAmountEditor({ kind: "goalSaved", title: "Вже накопичено" }, goalSaved)} />
            </div>
            <div className="hub-form-grid">
              <DateField label="Дата цілі" value={goalDate} onChange={setGoalDate} emptyText="Оберіть дату" />
              <button onClick={handleAddGoal}>Додати ціль</button>
            </div>
          </HubForm>

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
                    <button onClick={() => saveGoals(goals.filter((item) => item.id !== goal.id))}>Видалити</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "auto" && (
        <section className="hub-section">
          <SummaryCard title="Авто-категоризація" value={`${autoSuggestions.length}`} detail="пропозицій за історією" />
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

      {activeTab === "calendar" && (
        <section className="hub-section">
          <div className="hub-list">
            {calendarItems.length === 0 ? <EmptyState text="Календар поки порожній" /> : calendarItems.map((item) => (
              <div key={item.id} className="hub-card slim">
                <div className="hub-date">{new Date(item.date).toLocaleDateString("uk-UA", { day: "2-digit", month: "short" })}</div>
                <div className="hub-row">
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.kind}</small>
                  </div>
                  <b className={item.amount >= 0 ? "positive" : "negative"}>{formatValue(item.amount)}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "plan" && (
        <section className="hub-section">
          <SummaryCard title="План на місяць" value={monthlyPlanAmount > 0 ? formatValue(monthlyPlanAmount) : "Не задано"} detail={`Витрачено: ${formatValue(monthExpenses)}`} />
          <div className="hub-progress large"><span style={{ width: `${planProgress}%` }} /></div>
          <HubForm>
            <div className="hub-form-grid">
              <AmountButton label="Місячний ліміт" value={planAmount ? formatValue(Number(planAmount), mainCurrency) : "Обрати суму"} onClick={() => openAmountEditor({ kind: "plan", title: "Місячний ліміт" }, planAmount)} />
              <button onClick={handleSavePlan}>Зберегти</button>
            </div>
          </HubForm>
          <div className="hub-list">
            {categories.slice(0, 6).map((category) => {
              const spent = monthTransactions
                .filter((tx) => tx.type === "expense" && tx.category === category.id)
                .reduce((sum, tx) => sum + convertToMain(tx.amount, (tx.currency || "EUR") as Currency), 0);
              return (
                <div key={category.id} className="hub-card slim">
                  <div className="hub-row">
                    <div><strong>{category.icon} {category.name}</strong><small>за поточний місяць</small></div>
                    <b>{formatValue(spent)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "search" && (
        <section className="hub-section">
          <input className="hub-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пошук за сумою, описом або категорією" />
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
        <section className="hub-section">
          <SummaryCard title="Повторювані операції" value={`${upcomingSubscriptions.length}`} detail="активних списань" />
          <div className="hub-list">
            {upcomingSubscriptions.length === 0 ? <EmptyState text="Повторюваних операцій поки немає" /> : upcomingSubscriptions.map((sub) => (
              <div key={sub.id} className="hub-card slim">
                <div className="hub-row">
                  <div><strong>{sub.icon} {sub.name}</strong><small>{new Date(sub.nextDate).toLocaleDateString("uk-UA")}</small></div>
                  <b>{formatValue(sub.amount, sub.currency as Currency)}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "debts" && (
        <section className="hub-section">
          <div className="hub-summary-grid">
            <SummaryCard title="Мені винні" value={formatValue(totalDebtsToMe)} detail="активні борги" />
            <SummaryCard title="Я винен" value={formatValue(totalDebtsIOwe)} detail="до оплати" />
          </div>
          <HubForm>
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
          </HubForm>
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
