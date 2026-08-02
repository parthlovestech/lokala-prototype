import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function PrivacyPolicyContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lokala Privacy Policy</Text>
      <Text style={styles.meta}>Effective Date: January 2024</Text>
      <Text style={styles.meta}>Last Updated: January 2024</Text>

      <Text style={styles.p}>
        Lokala LLC ("<Text style={styles.bold}>Lokala</Text>," "<Text style={styles.bold}>we</Text>," "<Text style={styles.bold}>us</Text>," or "<Text style={styles.bold}>our</Text>") operates the mylokala.com website and the Lokala mobile application available on the Apple App Store (collectively, the "<Text style={styles.bold}>Services</Text>"). This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our Services.
      </Text>
      <Text style={styles.p}>
        This Privacy Policy is linked within the Lokala app and provided to Apple in App Store Connect, as required by Apple's App Store Review Guidelines.
      </Text>
      <Text style={styles.p}>
        By using the Services, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree, please do not use the Services.
      </Text>

      <Text style={styles.h2}>1. Information We Collect</Text>
      
      <Text style={styles.h3}>1.1 Information You Provide to Us</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>Account Information:</Text> Name, email address, and password when you create a Lokala account. Account creation is required to access the app, since all app features are tied to your individual account.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Payment Information:</Text> When you purchase a gift certificate on mylokala.com, payment details are collected and processed by our third-party payment processor, <Text style={styles.bold}>Stripe</Text>. Lokala does not store full payment card or bank account numbers on its own servers.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Gift Certificate Details:</Text> Sender, recipient, amount, and any personal message included with a gift certificate purchased on the website.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Merchant Information:</Text> Business name, address, tax identification information, bank account details (via Stripe), and QR code registration information, provided by businesses during sign-up.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Communications:</Text> Information you provide when you contact us for support, feedback, or inquiries.</Text>
      </View>

      <Text style={styles.h3}>1.2 Information Collected Automatically</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>Usage Data:</Text> How you interact with the app, including discounts viewed, features used, and transaction activity.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Device Information:</Text> Device type, operating system, and unique device identifiers.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Transaction Data:</Text> Purchase amounts, tip amounts, and gift certificate balance/redemption activity.</Text>
      </View>

      <Text style={styles.h3}>1.3 Information from Third Parties</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>Stripe:</Text> Shares limited transaction and account status information with us necessary to operate gift certificate balances and Merchant payouts.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Merchants:</Text> Participating businesses may share redemption confirmations with us.</Text>
      </View>

      <Text style={styles.h3}>1.4 Analytics</Text>
      <Text style={styles.p}>
        We use <Text style={styles.bold}>Supabase Analytics</Text> to collect usage data about how users interact with the app (such as screens viewed, features used, and general app performance). This data helps us understand usage patterns and improve the Services.
      </Text>

      <Text style={styles.h3}>1.5 Apple App Privacy Details</Text>
      <Text style={styles.p}>
        As required by Apple, we disclose the categories of data Lokala collects and how they are used on the app's product page on the App Store ("App Privacy" details), consistent with the categories described in this Privacy Policy.
      </Text>

      <Text style={styles.h2}>2. How We Use Your Information</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• Create and manage Lokala accounts.</Text>
        <Text style={styles.li}>• Display available discounts and gift certificate balances within the app.</Text>
        <Text style={styles.li}>• Process gift certificate purchases made via mylokala.com and reflect balances in the app.</Text>
        <Text style={styles.li}>• Facilitate in-app redemption of gift certificate balances at participating Merchants via QR code.</Text>
        <Text style={styles.li}>• Calculate and collect applicable processing fees.</Text>
        <Text style={styles.li}>• Provide customer support and respond to inquiries.</Text>
        <Text style={styles.li}>• Detect, investigate, and prevent fraud, unauthorized transactions, and misuse of the Services.</Text>
        <Text style={styles.li}>• Improve and personalize the Services.</Text>
        <Text style={styles.li}>• Communicate with you about your account or transactions.</Text>
        <Text style={styles.li}>• Comply with legal, tax, and regulatory obligations.</Text>
      </View>

      <Text style={styles.h2}>3. How We Share Your Information</Text>
      <Text style={styles.p}>We do not sell your personal information. We may share information with:</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>Stripe and other payment providers</Text> to process purchases and payouts.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Participating Merchants</Text>, limited to information necessary to confirm a transaction.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Service providers</Text> under confidentiality obligations.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Mid-Maine Chamber of Commerce and Colby College</Text>, in aggregate or de-identified form only.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Legal and regulatory authorities</Text> where required by law.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>In connection with a business transaction</Text> such as a merger or sale.</Text>
      </View>

      <Text style={styles.h2}>4. Data Retention</Text>
      <Text style={styles.p}>
        We retain personal and transaction information for as long as necessary to provide the Services, maintain accurate gift certificate balance records, comply with legal and tax obligations, and resolve disputes.
      </Text>

      <Text style={styles.h2}>5. Data Security</Text>
      <Text style={styles.p}>
        We use reasonable administrative, technical, and physical safeguards to protect your information, and we rely on Stripe's PCI-compliant infrastructure for payment data. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.
      </Text>

      <Text style={styles.h2}>6. Account Deletion</Text>
      <Text style={styles.p}>
        Because the app requires an account to use any feature, you may permanently delete your Lokala account and associated personal data directly within the app, from your account settings. Certain transaction records may be retained after deletion where required for legal, tax, or fraud-prevention purposes.
      </Text>

      <Text style={styles.h2}>7. Age Eligibility and Children's Privacy</Text>
      <Text style={styles.p}>
        The Services are intended for use by individuals who are at least 18 years old. We do not knowingly collect personal information from children under 13. If we learn that we have inadvertently collected personal information from a child under 13, we will delete it promptly.
      </Text>

      <Text style={styles.h2}>8. Your Choices and Rights</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>Access and Correction:</Text> Review and update your account information within the app or by contacting us.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Marketing Communications:</Text> Opt out of promotional emails via the unsubscribe link.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Deletion:</Text> Delete your account directly within the app.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>State Privacy Rights:</Text> Depending on your state of residence, you may have additional rights regarding your personal information.</Text>
      </View>

      <Text style={styles.h2}>9. Third-Party Links and Services</Text>
      <Text style={styles.p}>
        Our Services may link to third-party websites or services, including Merchant websites and Stripe. We are not responsible for the privacy practices of third parties.
      </Text>

      <Text style={styles.h2}>10. Changes to This Privacy Policy</Text>
      <Text style={styles.p}>
        We may update this Privacy Policy from time to time. We will post the revised policy with an updated "Last Updated" date within the app and on our website.
      </Text>

      <Text style={styles.h2}>11. Contact Us</Text>
      <Text style={styles.p}>
        Lokala LLC{'\n'}
        4 Drew St., Augusta, ME{'\n'}
        camalo29@colby.edu
      </Text>
    </View>
  );
}

export function TermsOfServiceContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lokala Terms of Use</Text>
      <Text style={styles.meta}>Effective Date: January 2024</Text>
      <Text style={styles.meta}>Last Updated: January 2024</Text>

      <Text style={styles.p}>
        Please read these Terms of Use ("<Text style={styles.bold}>Terms</Text>") carefully before using the mylokala.com website or the Lokala mobile application available on the Apple App Store (collectively, the "<Text style={styles.bold}>Services</Text>"), operated by Lokala LLC ("<Text style={styles.bold}>Lokala</Text>," "<Text style={styles.bold}>we</Text>," "<Text style={styles.bold}>us</Text>," or "<Text style={styles.bold}>our</Text>").
      </Text>
      <Text style={styles.p}>
        By creating an account, purchasing a gift certificate, or otherwise using the Services, you agree to be bound by these Terms and our Privacy Policy, which is incorporated by reference.
      </Text>

      <Text style={styles.h2}>1. Eligibility</Text>
      <Text style={styles.p}>
        You must be at least 18 years old to create a Lokala account or use the Services. The app is currently intended for use by individuals who are at least 18 years old, specifically Waterville college students and the communities of those institutions.
      </Text>

      <Text style={styles.h2}>2. Description of the Service</Text>
      <Text style={styles.p}>
        Lokala operates a discounts and digital gift certificate program for participating local businesses in and around Waterville, Maine. The Services allow:
      </Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>Gift Givers</Text> to purchase digital gift certificates for themselves or a recipient via mylokala.com.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Users</Text> to create a Lokala account, view available local discounts, and see their gift certificate balance within the Lokala app.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Users</Text> to redeem a gift certificate balance in person at participating Merchants by scanning the Merchant's unique QR code within the app.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Merchants</Text> to register through the Lokala business portal, link a bank account, and accept Lokala payments.</Text>
      </View>
      <Text style={styles.p}>
        An account is required to use any feature of the app, since discounts and balances shown are specific to each user's account. Balances are held and processed through our third-party payment processor, Stripe.
      </Text>

      <Text style={styles.h2}>3. Accounts</Text>
      <Text style={styles.p}>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate and current information and to notify us promptly of any unauthorized use of your account. You may delete your account at any time directly within the app.
      </Text>

      <Text style={styles.h2}>4. Discounts</Text>
      <Text style={styles.p}>
        Discounts displayed in the app are offered at the discretion of participating Merchants and may change or be withdrawn at any time without notice. Lokala does not guarantee the availability of any specific discount.
      </Text>

      <Text style={styles.h2}>5. Gift Certificates</Text>
      <Text style={styles.h3}>5.1 Purchase</Text>
      <Text style={styles.p}>Gift certificates are purchased through mylokala.com. Funds are held in a Stripe-based balance associated with the purchaser's or recipient's Lokala account.</Text>
      
      <Text style={styles.h3}>5.2 Use and Redemption</Text>
      <Text style={styles.p}>To redeem a balance, a user scans the participating Merchant's unique QR code within the app, enters any applicable tip, and submits payment. A successful transaction is confirmed via an in-app success screen. Screenshots of the app are disabled to help prevent fraud.</Text>

      <Text style={styles.h3}>5.3 No Cash Redemption</Text>
      <Text style={styles.p}>Except where required by law, gift certificate balances are not redeemable for cash and may only be used to purchase goods or services from participating Merchants in the Lokala network.</Text>

      <Text style={styles.h3}>5.4 No Expiration</Text>
      <Text style={styles.p}>Gift certificate balances never expire. In accordance with Maine law, a gift certificate's remaining value must be honored indefinitely and may not be subject to an expiration date.</Text>

      <Text style={styles.h3}>5.5 Errors and Disputes</Text>
      <Text style={styles.p}>If you believe a transaction was processed in error, contact us at camalo29@colby.edu. We will investigate in coordination with Stripe and the relevant Merchant.</Text>

      <Text style={styles.h2}>6. Merchant / Business Portal Terms</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• <Text style={styles.bold}>No Subscription Fee:</Text> There is no cost to join the Lokala network.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Processing Fee:</Text> Lokala deducts a processing fee from each transaction, excluding tips.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Bank Account Linking:</Text> Merchants must connect a valid bank account via Stripe to receive payouts.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Payout Schedule:</Text> Funds from completed transactions are scheduled for deposit to the Merchant's linked bank account.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>QR Code Use:</Text> Merchants are responsible for safeguarding their unique QR code.</Text>
        <Text style={styles.li}>• <Text style={styles.bold}>Compliance:</Text> Merchants agree to comply with all applicable laws in accepting Lokala payments, including tax reporting obligations.</Text>
      </View>

      <Text style={styles.h2}>7. Fees</Text>
      <Text style={styles.p}>
        Lokala does not charge users a fee to purchase a standard gift certificate beyond its face value, except as disclosed at checkout. Lokala charges Merchants a processing fee per transaction, which is never deducted from tips.
      </Text>

      <Text style={styles.h2}>8. Prohibited Conduct</Text>
      <Text style={styles.p}>You agree not to:</Text>
      <View style={styles.list}>
        <Text style={styles.li}>• Use the Services for any unlawful purpose, including fraud or money laundering.</Text>
        <Text style={styles.li}>• Attempt to circumvent, disable, or interfere with security features.</Text>
        <Text style={styles.li}>• Misrepresent your identity or a business's eligibility.</Text>
        <Text style={styles.li}>• Use another person's account or gift certificate balance without authorization.</Text>
        <Text style={styles.li}>• Reverse-engineer or decompile the app.</Text>
      </View>

      <Text style={styles.h2}>9. Intellectual Property; License</Text>
      <Text style={styles.p}>
        All trademarks, logos, app design, and content associated with Lokala are owned by Lokala LLC or its licensors. We grant you a limited, non-exclusive, non-transferable, revocable license to use the Lokala app on any Apple-branded device that you own or control.
      </Text>

      <Text style={styles.h2}>10. Third-Party Services</Text>
      <Text style={styles.p}>
        The Services rely on third-party providers, including Stripe, for payment processing. Your use of these third-party services may be subject to their own terms and privacy policies.
      </Text>

      <Text style={styles.h2}>11. Apple App Store Terms</Text>
      <Text style={styles.p}>
        These Terms are between you and Lokala only, and not with Apple. Lokala, not Apple, is solely responsible for the app and its content. Apple has no obligation to furnish any maintenance or support. Apple and Apple's subsidiaries are third-party beneficiaries of these Terms.
      </Text>

      <Text style={styles.h2}>12. Disclaimers</Text>
      <Text style={[styles.p, styles.uppercase]}>
        THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. THIS DISCLAIMER DOES NOT LIMIT ANY WARRANTY REQUIRED BY APPLICABLE CONSUMER PROTECTION LAW.
      </Text>

      <Text style={styles.h2}>13. Limitation of Liability</Text>
      <Text style={[styles.p, styles.uppercase]}>
        TO THE FULLEST EXTENT PERMITTED BY LAW, LOKALA AND ITS AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICES.
      </Text>

      <Text style={styles.h2}>14. Indemnification</Text>
      <Text style={styles.p}>
        You agree to indemnify and hold harmless Lokala, its founders, affiliates, and partners from any claims, damages, or expenses arising from your violation of these Terms or misuse of the Services.
      </Text>

      <Text style={styles.h2}>15. Governing Law and Dispute Resolution</Text>
      <Text style={styles.p}>
        These Terms are governed by the laws of the State of Maine. Any dispute arising out of or relating to these Terms shall be resolved exclusively in the state or federal courts located in Kennebec County, Maine.
      </Text>

      <Text style={styles.h2}>16. Changes to These Terms</Text>
      <Text style={styles.p}>
        We may modify these Terms from time to time. Material changes will be communicated via the app, website, or email. Continued use constitutes acceptance.
      </Text>

      <Text style={styles.h2}>17. Termination</Text>
      <Text style={styles.p}>
        We may suspend or terminate your account at our discretion, including for suspected fraud or violation of these Terms. You may stop using the Services, and delete your account, at any time.
      </Text>

      <Text style={styles.h2}>18. Contact Us</Text>
      <Text style={styles.p}>
        Lokala LLC{'\n'}
        4 Drew St., Augusta, ME{'\n'}
        camalo29@colby.edu
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  meta: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 28,
    marginBottom: 12,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  p: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  list: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  li: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 8,
  },
  uppercase: {
    textTransform: 'uppercase',
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  }
});