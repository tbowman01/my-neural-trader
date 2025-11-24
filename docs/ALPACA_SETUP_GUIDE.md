# How to Get Alpaca API Keys (FREE)

This guide walks you through creating a FREE Alpaca paper trading account and getting your API keys.

## What is Alpaca?

Alpaca is a commission-free trading platform that provides:
- **FREE Paper Trading**: $100,000 virtual capital to practice with
- **Real-time Market Data**: Live stock prices and quotes
- **No Credit Card Required**: Completely free for paper trading
- **Professional API**: Same API used by real traders

## Step-by-Step Guide

### Step 1: Sign Up for Alpaca

1. **Go to Alpaca's Website**
   - Visit: https://alpaca.markets
   - Click the "Sign Up" button in the top right corner

2. **Create Your Account**
   - Enter your email address
   - Create a strong password
   - Click "Sign Up"

3. **Verify Your Email**
   - Check your email inbox
   - Click the verification link from Alpaca
   - This confirms your account

### Step 2: Access Paper Trading

1. **Log In to Your Account**
   - Go to: https://app.alpaca.markets
   - Enter your email and password
   - Click "Log In"

2. **Navigate to Paper Trading**
   - Once logged in, you'll see the main dashboard
   - Look for the toggle in the top-right that says "Paper" or "Live"
   - Make sure **"Paper"** is selected (it should be by default)
   - Paper trading gives you $100,000 in virtual money

### Step 3: Generate API Keys

1. **Go to API Keys Section**
   - In the left sidebar, click on your profile/account menu
   - Click "API Keys" or "Your API Keys"
   - Alternative: Direct link: https://app.alpaca.markets/paper/dashboard/overview

2. **View Your Paper Trading Keys**
   - You should see a section for "Paper Trading"
   - There will be two keys displayed:
     - **API Key ID** (starts with "PK")
     - **Secret Key** (long alphanumeric string)

3. **Copy Your Keys**
   - Click the "View" or "Reveal" button next to the Secret Key
   - Copy the **API Key ID** (looks like: `PKXXXXXXXXXX`)
   - Copy the **Secret Key** (looks like: `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

   **IMPORTANT**: The Secret Key is only shown once! Save it immediately.
   If you lose it, you'll need to regenerate new keys.

### Step 4: Configure Your .env File

1. **Open your .env file** in the project:
   ```bash
   # On Windows with VS Code
   code .env

   # Or any text editor
   notepad .env
   ```

2. **Replace the placeholder values** with your actual keys:
   ```bash
   # Before (placeholder values)
   ALPACA_API_KEY=PKXXXXXXXXXXXXXX
   ALPACA_API_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

   # After (your actual keys)
   ALPACA_API_KEY=PKABCD1234567890
   ALPACA_API_SECRET=abc123def456ghi789jklmno012pqr345
   ```

3. **Save the file** (Ctrl+S or Cmd+S)

### Step 5: Test Your Connection

Run the basic trading example to verify your keys work:

```bash
node examples/01-basic-trading.js
```

You should see output like:
```
📡 Connecting to Alpaca paper trading...
✅ Connected to Alpaca

💰 Fetching account balance...
Account Balance:
  Cash:         $100000.00
  Equity:       $100000.00
  Buying Power: $400000.00
  Currency:     USD
```

## Troubleshooting

### "Failed to connect to Alpaca"

**Problem**: Your API keys might be incorrect or from live trading instead of paper.

**Solution**:
1. Double-check you copied the keys correctly (no extra spaces)
2. Make sure you're using **Paper Trading** keys, not Live Trading
3. Verify the keys on your Alpaca dashboard
4. Try regenerating new keys if needed

### "Invalid API key format"

**Problem**: The key format is incorrect.

**Solution**:
- API Key should start with "PK" (Paper Key)
- Secret Key should be a long alphanumeric string
- Make sure there are no spaces or line breaks in the keys

### "Rate limit exceeded"

**Problem**: You're making too many requests.

**Solution**:
- Alpaca free tier allows 200 requests per minute
- Add delays between requests in your code
- This is rarely an issue for learning/testing

### "Market is closed"

**Problem**: US stock market is closed.

**Solution**:
- US markets are open Mon-Fri, 9:30 AM - 4:00 PM Eastern Time
- You can still view your account and positions when closed
- Orders placed when closed will execute when market opens
- Paper trading works 24/7, but follows market hours for order execution

## Security Best Practices

### DO:
- ✅ Keep your Secret Key private
- ✅ Store keys in `.env` file (already gitignored)
- ✅ Use paper trading keys for learning
- ✅ Regenerate keys if you suspect they're compromised

### DON'T:
- ❌ Share your keys with anyone
- ❌ Commit `.env` to git
- ❌ Post keys in forums, Discord, or public places
- ❌ Use live trading keys until you're consistently profitable

## What's Included with Free Paper Trading

With your free Alpaca paper trading account, you get:

- **$100,000 virtual capital**: Practice with realistic amounts
- **Real-time market data**: Live prices during market hours
- **Full API access**: Same features as live trading
- **No time limit**: Keep your account forever
- **No credit card needed**: Completely free
- **4x buying power**: $400,000 total (includes margin)
- **All order types**: Market, limit, stop-loss, etc.
- **Unlimited trades**: Trade as much as you want

## Upgrading to Live Trading

When you're ready for real money trading:

1. **Prove Profitability First**:
   - Trade consistently profitable in paper for 3-6 months
   - Backtest strategies thoroughly
   - Understand risk management

2. **Complete Verification**:
   - Alpaca will ask for ID verification
   - Bank account linking
   - W-9 tax form (US) or W-8BEN (international)

3. **Start Small**:
   - Begin with money you can afford to lose
   - Don't use live trading keys in development
   - Keep paper trading for testing new strategies

## Useful Links

- **Alpaca Dashboard**: https://app.alpaca.markets
- **Alpaca Documentation**: https://alpaca.markets/docs/
- **API Reference**: https://alpaca.markets/docs/api-references/
- **Status Page**: https://status.alpaca.markets/
- **Support**: https://alpaca.markets/support

## Next Steps

Once you have your API keys configured:

1. ✅ Run `node examples/01-basic-trading.js` to test connection
2. ✅ Run `node examples/02-strategy-backtest.js` to test a strategy
3. ✅ Read the main README.md for learning resources
4. ✅ Start experimenting with different strategies
5. ✅ Check your Alpaca dashboard to see trades

---

**Questions?** Check the Alpaca documentation or their support resources. The paper trading account is completely free and risk-free - perfect for learning!
