# 📱 GCash SMS Forwarder Setup Guide

This guide explains how to set up a free SMS-forwarding system on your Android phone to automatically send GCash payment receipts to your BonWifi Windows PC server. This enables 100% automated payment processing without any merchant fees or API costs.

---

## 🛠️ Option 1: MacroDroid (Recommended)

**MacroDroid** is a free, powerful automation app for Android. You only need 1 simple macro (which is within the free limit of 5 macros).

### Step 1: Install MacroDroid
1. Open the **Google Play Store** on the Android phone containing the SIM card linked to your GCash account.
2. Search for and install **MacroDroid - Device Automation**.

### Step 2: Create the Macro
1. Open MacroDroid and tap **Add Macro**.
2. **Name the macro**: `BonWifi GCash Webhook`

#### 1. Trigger (Red Section)
1. Tap the **+** button in the Triggers section.
2. Choose **Device Events** ➔ **SMS Received**.
3. Select **Select Number(s)**.
4. Set the number to match `GCash` and `2882`. (You can also type a specific phone number or select "Any Number" for initial testing).
5. Set the Message Content to **Any Content** (or choose "Contains" and specify "received" or "GCash" if you want to filter out non-payment SMS).
6. Tap **OK**.

#### 2. Action (Blue Section)
1. Tap the **+** button in the Actions section.
2. Choose **Applications** ➔ **HTTP Request**.
3. Configure the HTTP Request as follows:
   * **Method**: `POST`
   * **URL**: `http://<YOUR_PC_IP>:3000/api/sms-webhook`
     *(Replace `<YOUR_PC_IP>` with the local IP address of your Windows PC, e.g. `192.168.137.1` if using Windows Mobile Hotspot).*
   * **Content Type**: `application/json`
   * **Request Body**:
     Copy and paste the exact text below:
     ```json
     {
       "sender": "{sms_number}",
       "message": "{sms_message}",
       "secret": "super_secret_webhook_token"
     }
     ```
     *(If you customized `SMS_WEBHOOK_SECRET` in your `.env` file, replace `super_secret_webhook_token` with your custom token).*
4. Tap **OK** to save the action.

#### 3. Constraints (Yellow Section)
Leave this section empty.

### Step 3: Save and Enable
1. Tap the checkmark icon at the bottom right to save the macro.
2. Ensure MacroDroid is enabled (the toggle switch in the app's top bar is turned ON).

---

## 🛠️ Option 2: SmsForwarder (Open Source)

If you prefer a dedicated open-source app with no limits, you can use **SmsForwarder**.

### Step 1: Download & Install
1. Download the latest `.apk` from the official GitHub repository: [SmsForwarder GitHub Releases](https://github.com/pppscn/SmsForwarder/releases).
2. Install the APK on your Android device (you may need to allow installation from unknown sources).

### Step 2: Configure Sender
1. Open the app and go to **Sender** ➔ Add Sender.
2. Select **Web** (Webhook).
3. Set the Webhook URL to: `http://<YOUR_PC_IP>:3000/api/sms-webhook`
4. Set the Method to **POST**.
5. Select Content Type **application/json**.
6. Set the Header/Parameters to include the secret:
   * Add Header: `x-webhook-secret: super_secret_webhook_token`
7. Set the Body template to:
   ```json
   {
     "sender": "{{from}}",
     "message": "{{body}}"
   }
   ```
8. Save and test the connection.

### Step 3: Configure Rules
1. Go to **Rules** ➔ Add Rule.
2. Select **SMS** as the source.
3. Add a filter rule:
   * **Sender** `Matches` `GCash` or `2882`
4. Assign this rule to the Web Sender you created in Step 2.
5. Save the rule.

---

## ⚡ Crucial Android Optimization Tips

Android's battery saving systems can pause or terminate background apps like MacroDroid or SmsForwarder when the screen is locked, leading to payment delays.

1. **Disable Battery Optimization:**
   * Go to **Settings ➔ Apps ➔ MacroDroid ➔ Battery** (or Battery usage).
   * Set it to **Unrestricted** (or turn off "Optimize battery usage").
2. **Keep the SIM Active & Charged:**
   * Place the phone in a location with good signal strength.
   * Keep it plugged into a charger so it does not power down.
3. **Allow Autostart / Background Activity:**
   * Ensure the app is permitted to run automatically on device boot and remain active in the background.
