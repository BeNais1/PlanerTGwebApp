@echo off
REM Script to commit all bug fixes
cd /d "C:\Users\boris\Desktop\my app"

echo Configuring git user...
git config --global user.name "Copilot"
git config --global user.email "223556219+Copilot@users.noreply.github.com"

echo Adding all changes...
git add -A

echo Creating commit...
git commit -m "Fix 6 critical bugs in expense tracker

- Fix #1: Add isMounted cleanup to prevent state updates on unmounted component in useTelegramAuth
- Fix #2: Simplify token assignment logic in useTelegramAuth (remove redundant savedToken)
- Fix #3: Add missing walletBalances dependency in SpendModal useEffect
- Fix #4: Add defensive check for unsub function call in QuickSpendModal cleanup
- Fix #5: Add try-catch-finally error handling to 5 async transaction handlers in HomePage
- Fix #6: Avoid parameter mutation by creating new object in database.addTransaction

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

echo Done! Changes are committed.
git log -1 --oneline
pause
