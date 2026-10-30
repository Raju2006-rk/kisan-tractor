"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CircleHelp,
  Clock3,
  HandCoins,
  KeyRound,
  LockKeyhole,
  PhoneCall,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Sprout,
  Wallet,
} from "lucide-react";
import {
  Alert,
  Badge,
  Card,
  buttonStyles,
} from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/types";

type SectionId = "booking" | "billing" | "pricing" | "cancellation" | "ivr" | "safety";

const ICONS: Record<SectionId, typeof Sprout> = {
  booking: CalendarCheck,
  billing: HandCoins,
  pricing: Clock3,
  cancellation: CircleHelp,
  ivr: PhoneCall,
  safety: ShieldCheck,
};

const copy: Partial<
  Record<
    Language,
    {
      title: string;
      subtitle: string;
      quickTitle: string;
      sections: { id: SectionId; title: string; body: string; points: string[] }[];
      faqTitle: string;
      faqs: { q: string; a: string }[];
      helpCta: string;
      bookingsCta: string;
    }
  >
> = {
  en: {
    title: "Help & support",
    subtitle: "Simple answers about booking, billing and paying the tractor owner directly.",
    quickTitle: "Quick answers",
    sections: [
      {
        id: "booking",
        title: "How a booking works",
        body: "A booking is a request first. The tractor owner must accept before work is scheduled.",
        points: [
          "Choose a nearby tractor, work type and the rate shown before you send.",
          "The owner accepts or declines. You are notified either way.",
          "The owner starts, pauses and finishes work. Active time or measured work is recorded.",
          "You review the final bill, pay the owner directly, and the owner confirms receipt.",
        ],
      },
      {
        id: "billing",
        title: "Final bill and payment received",
        body: "These are two separate records. The final bill is what is owed; payment received is what the owner confirms receiving.",
        points: [
          "Final Bill Amount is calculated from the agreed rate and actual active work, acres or trips.",
          "Payment Received is shown only after the tractor owner checks their own UPI app, bank account or cash.",
          "Recording a payment on your side does not mark the booking paid. The owner must confirm.",
          "KisanTractor holds no money, takes no commission, and never processes the payment.",
        ],
      },
      {
        id: "pricing",
        title: "Hourly, per acre or per trip",
        body: "The rate you choose is saved with the booking and stays unchanged. The estimate is not the final bill.",
        points: [
          "Hourly: only active work time is billed. Pauses and breaks are recorded separately and not billed.",
          "Per acre: the owner records the completed area at the end of the work.",
          "Per trip: you pay for the completed trips agreed in the booking.",
          "The final amount is always calculated by the backend from the recorded work.",
        ],
      },
      {
        id: "cancellation",
        title: "Cancellation and issues",
        body: "Before work starts, either side can cancel from the booking. After work starts, use the issue process so the records stay intact.",
        points: [
          "Pending, accepted and scheduled bookings can be cancelled with a reason.",
          "After work starts, open the booking and use Report an issue.",
          "A dispute preserves the original booking, work sessions, final bill and payment records.",
          "Contact details are shared only after the owner accepts, for work coordination.",
        ],
      },
      {
        id: "ivr",
        title: "Phone keypad booking",
        body: "IVR booking is coming soon. There is no working phone number for it yet.",
        points: [
          "We are building a simple keypad flow for farmers who prefer a basic phone.",
          "No IVR number is published until the service is live and tested.",
          "For now, use the app to book a tractor or ask a local owner directly.",
          "This page will be updated when keypad booking becomes available.",
        ],
      },
      {
        id: "safety",
        title: "Your safety",
        body: "KisanTractor will never ask for banking secrets. Keep them private, even if someone claims to be from the platform.",
        points: [
          "Never share a bank OTP, UPI PIN, card PIN or password with anyone.",
          "Pay only the amount shown as the final bill, and only to the owner you booked.",
          "Use the in-app issue process if the work or bill does not match.",
          "Your mobile number is used for login and booking coordination.",
        ],
      },
    ],
    faqTitle: "Common questions",
    faqs: [
      {
        q: "Do I pay KisanTractor?",
        a: "No. You pay the tractor owner directly by UPI, cash, bank transfer or another agreed method. KisanTractor does not collect money and takes no commission.",
      },
      {
        q: "Why is my payment still pending after I paid?",
        a: "Paying outside the app does not update the booking automatically. The tractor owner checks their own UPI app, bank account or cash and taps Mark payment done. Only then does the booking show Payment Received. Farmers never record a payment in KisanTractor.",
      },
      {
        q: "Can I book for a family member?",
        a: "Yes. Choose Someone else in the booking flow and add the recipient’s name and mobile number. They do not need an account.",
      },
      {
        q: "Is the estimate the final amount?",
        a: "No. The estimate helps you plan. The final bill uses the agreed rate and the actual active time, measured acres or completed trips.",
      },
      {
        q: "Can I book by phone keypad?",
        a: "Not yet. IVR booking is coming soon and no phone number is active. Please use the app for now.",
      },
    ],
    helpCta: "Go to my bookings",
    bookingsCta: "Find a tractor",
  },
  hi: {
    title: "सहायता और समर्थन",
    subtitle: "बुकिंग, बिल और ट्रैक्टर मालिक को सीधे भुगतान के आसान जवाब।",
    quickTitle: "जल्दी जवाब",
    sections: [
      {
        id: "booking",
        title: "बुकिंग कैसे होती है",
        body: "बुकिंग पहले एक अनुरोध है। काम तय होने से पहले ट्रैक्टर मालिक को स्वीकार करना होता है।",
        points: [
          "पास का ट्रैक्टर, काम का प्रकार और भेजने से पहले दिखने वाला दाम चुनें।",
          "मालिक स्वीकार या अस्वीकार करता है। दोनों में आपको सूचना मिलती है।",
          "मालिक काम शुरू, रोक और खत्म करता है। सक्रिय समय या नापा गया काम दर्ज होता है।",
          "आप अंतिम बिल देखते हैं, मालिक को सीधे भुगतान करते हैं, और मालिक प्राप्ति की पुष्टि करता है।",
        ],
      },
      {
        id: "billing",
        title: "अंतिम बिल और प्राप्त भुगतान",
        body: "ये दो अलग रिकॉर्ड हैं। अंतिम बिल बकाया राशि है; प्राप्त भुगतान वह है जिसकी पुष्टि मालिक करता है।",
        points: [
          "अंतिम बिल तय दाम और वास्तविक सक्रिय काम, एकड़ या ट्रिप से बनता है।",
          "प्राप्त भुगतान तभी दिखता है जब मालिक अपना UPI ऐप, बैंक खाता या नकद जांच लेता है।",
          "आपकी ओर से भुगतान दर्ज करने से बुकिंग का भुगतान पूरा नहीं होता। मालिक को पुष्टि करनी होती है।",
          "KisanTractor पैसा नहीं रखता, कमीशन नहीं लेता और भुगतान प्रोसेस नहीं करता।",
        ],
      },
      {
        id: "pricing",
        title: "घंटा, एकड़ या ट्रिप",
        body: "आपका चुना दाम बुकिंग के साथ सुरक्षित रहता है और नहीं बदलता। अनुमान अंतिम बिल नहीं है।",
        points: [
          "घंटा: केवल सक्रिय काम का समय बिल होता है। रुकने का समय अलग दर्ज होता है और बिल में नहीं आता।",
          "एकड़: काम के अंत में मालिक पूरा हुआ क्षेत्र दर्ज करता है।",
          "ट्रिप: बुकिंग में तय पूरे हुए ट्रिप का भुगतान होता है।",
          "अंतिम राशि हमेशा दर्ज काम से बैकएंड में बनती है।",
        ],
      },
      {
        id: "cancellation",
        title: "रद्दीकरण और समस्या",
        body: "काम शुरू होने से पहले दोनों पक्ष बुकिंग से रद्द कर सकते हैं। काम शुरू होने के बाद समस्या दर्ज करें।",
        points: [
          "प्रतीक्षा, स्वीकृत और निर्धारित बुकिंग कारण के साथ रद्द हो सकती हैं।",
          "काम शुरू होने के बाद बुकिंग खोलें और समस्या दर्ज करें।",
          "समस्या के दौरान मूल बुकिंग, काम के समय, अंतिम बिल और भुगतान रिकॉर्ड सुरक्षित रहते हैं।",
          "संपर्क विवरण मालिक के स्वीकार करने के बाद ही काम के तालमेल के लिए दिखते हैं।",
        ],
      },
      {
        id: "ivr",
        title: "फोन कीपैड से बुकिंग",
        body: "IVR बुकिंग जल्द आ रही है। अभी इसके लिए कोई चालू फोन नंबर नहीं है।",
        points: [
          "हम उन किसानों के लिए आसान कीपैड प्रक्रिया बना रहे हैं जो साधारण फोन पसंद करते हैं।",
          "सेवा चालू और जांच होने तक कोई IVR नंबर प्रकाशित नहीं किया जाएगा।",
          "अभी ऐप से ट्रैक्टर बुक करें या स्थानीय मालिक से सीधे बात करें।",
          "कीपैड बुकिंग शुरू होने पर यह पेज अपडेट होगा।",
        ],
      },
      {
        id: "safety",
        title: "आपकी सुरक्षा",
        body: "KisanTractor कभी बैंकिंग गोपनीय जानकारी नहीं मांगेगा। किसी के कहने पर भी इसे साझा न करें।",
        points: [
          "बैंक OTP, UPI PIN, कार्ड PIN या पासवर्ड किसी से साझा न करें।",
          "केवल अंतिम बिल में दिख रही राशि, और केवल उसी मालिक को दें जिसे आपने बुक किया।",
          "काम या बिल सही न लगे तो ऐप में समस्या दर्ज करें।",
          "आपका मोबाइल नंबर लॉगिन और बुकिंग तालमेल के लिए है।",
        ],
      },
    ],
    faqTitle: "आम सवाल",
    faqs: [
      {
        q: "क्या मैं KisanTractor को पैसे देता हूँ?",
        a: "नहीं। आप ट्रैक्टर मालिक को सीधे UPI, नकद, बैंक ट्रांसफर या तय तरीके से भुगतान करते हैं। KisanTractor पैसा नहीं लेता और कमीशन नहीं लेता।",
      },
      {
        q: "भुगतान के बाद भी पेंडिंग क्यों दिखता है?",
        a: "आपका रिकॉर्ड प्राप्ति का सबूत नहीं है। मालिक अपना UPI ऐप, बैंक खाता या नकद जांचकर पुष्टि करता है। तभी प्राप्त भुगतान दिखता है।",
      },
      {
        q: "क्या मैं परिवार के लिए बुक कर सकता हूँ?",
        a: "हाँ। बुकिंग में ‘कोई और’ चुनें और उनका नाम व मोबाइल नंबर डालें। उनका खाता होना जरूरी नहीं।",
      },
      {
        q: "क्या अनुमान ही अंतिम राशि है?",
        a: "नहीं। अनुमान योजना के लिए है। अंतिम बिल तय दाम और वास्तविक सक्रिय समय, एकड़ या ट्रिप से बनता है।",
      },
      {
        q: "क्या फोन कीपैड से बुकिंग हो सकती है?",
        a: "अभी नहीं। IVR बुकिंग जल्द आ रही है और कोई नंबर चालू नहीं है। अभी ऐप का उपयोग करें।",
      },
    ],
    helpCta: "मेरी बुकिंग देखें",
    bookingsCta: "ट्रैक्टर खोजें",
  },
  mr: {
    title: "मदत आणि आधार",
    subtitle: "बुकिंग, बिल आणि ट्रॅक्टर मालकाला थेट पेमेंटबद्दल सोपी उत्तरे.",
    quickTitle: "पटकन उत्तरे",
    sections: [
      {
        id: "booking",
        title: "बुकिंग कशी होते",
        body: "बुकिंग ही पहिली विनंती असते. काम ठरवण्यापूर्वी ट्रॅक्टर मालकाने स्वीकारणे आवश्यक आहे.",
        points: [
          "जवळचा ट्रॅक्टर, कामाचा प्रकार आणि पाठवण्यापूर्वी दिसणारा दर निवडा.",
          "मालक स्वीकार किंवा नकार देतो. दोन्ही परिस्थितीत तुम्हाला सूचना मिळते.",
          "मालक काम सुरू, थांबवतो आणि संपवतो. सक्रिय वेळ किंवा मोजलेले काम नोंदवले जाते.",
          "तुम्ही अंतिम बिल पाहता, मालकाला थेट पैसे देता आणि मालक पावतीची पुष्टी करतो.",
        ],
      },
      {
        id: "billing",
        title: "अंतिम बिल आणि मिळालेले पेमेंट",
        body: "हे दोन वेगळे रेकॉर्ड आहेत. अंतिम बिल म्हणजे देय रक्कम; मिळालेले पेमेंट म्हणजे मालकाने पुष्टी केलेली रक्कम.",
        points: [
          "अंतिम बिल ठरलेला दर आणि प्रत्यक्ष सक्रिय काम, एकर किंवा ट्रिपवरून तयार होते.",
          "मालकाने स्वतःचे UPI अ‍ॅप, बँक खाते किंवा रोख तपासल्यावरच मिळालेले पेमेंट दिसते.",
          "तुमच्या बाजूने पेमेंट नोंदवल्याने बुकिंग पेड होत नाही. मालकाने पुष्टी करणे आवश्यक आहे.",
          "KisanTractor पैसे ठेवत नाही, कमिशन घेत नाही आणि पेमेंट प्रोसेस करत नाही.",
        ],
      },
      {
        id: "pricing",
        title: "तास, एकर किंवा ट्रिप",
        body: "तुम्ही निवडलेला दर बुकिंगसोबत जतन होतो आणि बदलत नाही. अंदाज हे अंतिम बिल नाही.",
        points: [
          "तास: फक्त सक्रिय कामाचा वेळ बिल होतो. विश्रांतीचा वेळ वेगळा नोंदवला जातो आणि बिलात येत नाही.",
          "एकर: कामाच्या शेवटी मालक पूर्ण झालेले क्षेत्र नोंदवतो.",
          "ट्रिप: बुकिंगमध्ये ठरलेल्या पूर्ण ट्रिपचे पैसे दिले जातात.",
          "अंतिम रक्कम नेहमी नोंदवलेल्या कामावरून बॅकएंडमध्ये तयार होते.",
        ],
      },
      {
        id: "cancellation",
        title: "रद्द करणे आणि तक्रार",
        body: "काम सुरू होण्यापूर्वी दोन्ही बाजू बुकिंग रद्द करू शकतात. काम सुरू झाल्यावर तक्रार नोंदवा.",
        points: [
          "प्रतीक्षेत, स्वीकारलेली आणि नियोजित बुकिंग कारणासह रद्द होऊ शकते.",
          "काम सुरू झाल्यावर बुकिंग उघडा आणि तक्रार नोंदवा.",
          "तक्रारीदरम्यान मूळ बुकिंग, कामाची वेळ, अंतिम बिल आणि पेमेंट रेकॉर्ड सुरक्षित राहतात.",
          "संपर्क तपशील मालकाने स्वीकारल्यावरच कामाच्या समन्वयासाठी दिसतात.",
        ],
      },
      {
        id: "ivr",
        title: "फोन कीपॅडवरून बुकिंग",
        body: "IVR बुकिंग लवकरच येत आहे. सध्या त्यासाठी कार्यरत फोन नंबर नाही.",
        points: [
          "साधा फोन वापरणाऱ्या शेतकऱ्यांसाठी आम्ही सोपी कीपॅड प्रक्रिया बनवत आहोत.",
          "सेवा सुरू आणि तपासली जाईपर्यंत कोणताही IVR नंबर प्रकाशित केला जाणार नाही.",
          "सध्या अ‍ॅपमधून ट्रॅक्टर बुक करा किंवा स्थानिक मालकाशी थेट बोला.",
          "कीपॅड बुकिंग सुरू झाल्यावर हे पान अपडेट होईल.",
        ],
      },
      {
        id: "safety",
        title: "तुमची सुरक्षा",
        body: "KisanTractor कधीही बँकिंग गुपिते मागणार नाही. कोणी सांगितले तरी ती कोणालाही देऊ नका.",
        points: [
          "बँक OTP, UPI PIN, कार्ड PIN किंवा पासवर्ड कोणालाही सांगू नका.",
          "फक्त अंतिम बिलातील रक्कम आणि फक्त तुम्ही बुक केलेल्या मालकाला पैसे द्या.",
          "काम किंवा बिल जुळत नसेल तर अ‍ॅपमध्ये तक्रार नोंदवा.",
          "तुमचा मोबाइल नंबर लॉगिन आणि बुकिंग समन्वयासाठी वापरला जातो.",
        ],
      },
    ],
    faqTitle: "नेहमीचे प्रश्न",
    faqs: [
      {
        q: "मी KisanTractor ला पैसे देतो का?",
        a: "नाही. तुम्ही ट्रॅक्टर मालकाला थेट UPI, रोख, बँक ट्रान्सफर किंवा ठरलेल्या पद्धतीने पैसे देता. KisanTractor पैसे घेत नाही आणि कमिशन घेत नाही.",
      },
      {
        q: "पैसे दिल्यावरही पेमेंट पेंडिंग का दिसते?",
        a: "तुमची नोंद पावतीचा पुरावा नाही. मालकाने स्वतःचे UPI अ‍ॅप, बँक खाते किंवा रोख तपासून पुष्टी केल्यावरच मिळालेले पेमेंट दिसते.",
      },
      {
        q: "मी कुटुंबासाठी बुक करू शकतो का?",
        a: "हो. बुकिंगमध्ये ‘दुसरे कोणी’ निवडा आणि त्यांचे नाव व मोबाइल नंबर द्या. त्यांचे खाते असणे आवश्यक नाही.",
      },
      {
        q: "अंदाज हीच अंतिम रक्कम आहे का?",
        a: "नाही. अंदाज नियोजनासाठी आहे. अंतिम बिल ठरलेला दर आणि प्रत्यक्ष सक्रिय वेळ, एकर किंवा ट्रिपवरून तयार होते.",
      },
      {
        q: "फोन कीपॅडवरून बुकिंग होते का?",
        a: "सध्या नाही. IVR बुकिंग लवकरच येत आहे आणि कोणताही नंबर सुरू नाही. सध्या अ‍ॅप वापरा.",
      },
    ],
    helpCta: "माझी बुकिंग पहा",
    bookingsCta: "ट्रॅक्टर शोधा",
  },
};

export function HelpScreen() {
  const { language } = useI18n();
  const content = copy[language] ?? copy.en!;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone="green" dot>
            <CircleHelp className="size-3" /> KisanTractor help
          </Badge>
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone/70">
            Niphad · Nashik
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl text-forest sm:text-[2.4rem]">{content.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone">{content.subtitle}</p>
      </div>

      <Alert tone="info">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            KisanTractor is a direct connection between farmers and tractor owners. No payment
            gateway, no money held by the platform, no commission.
          </span>
        </span>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {content.sections.map((section) => {
          const Icon = ICONS[section.id];
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="group flex items-start gap-3 rounded-2xl border border-line/80 bg-paper p-4 shadow-[var(--shadow-card)] transition hover:border-forest/25"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-forest">{section.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-[0.65rem] leading-relaxed text-stone">
                  {section.body}
                </span>
              </span>
              <ArrowRight className="ml-auto mt-1 size-3.5 shrink-0 text-stone transition group-hover:text-clay" />
            </a>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr] lg:items-start">
        <div className="space-y-4">
          {content.sections.map((section) => {
            const Icon = ICONS[section.id];
            return (
              <Card key={section.id} className="scroll-mt-24 p-5 sm:p-6" as="section">
                <div id={section.id} className="scroll-mt-24" />
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-forest/8 text-forest">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl text-forest">{section.title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-stone">{section.body}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-stone">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-moss" />
                      {point}
                    </li>
                  ))}
                </ul>
                {section.id === "billing" ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-wheat/60 bg-wheat/20 px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#7a5a1d]">
                        <ReceiptText className="size-3" /> Final Bill Amount
                      </p>
                      <p className="mt-1 text-[0.66rem] leading-relaxed text-[#6d5118]">
                        What the owner calculated for the completed work. The agreed rate stays
                        unchanged.
                      </p>
                    </div>
                    <div className="rounded-xl border border-forest/15 bg-forest/5 px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-forest">
                        <Wallet className="size-3" /> Payment Received
                      </p>
                      <p className="mt-1 text-[0.66rem] leading-relaxed text-forest/75">
                        Confirmed only after the owner checks their own UPI app, bank account or cash.
                      </p>
                    </div>
                  </div>
                ) : null}
                {section.id === "ivr" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-clay/30 bg-clay/5 px-3.5 py-3">
                    <Badge tone="clay" dot>
                      Coming soon
                    </Badge>
                    <p className="text-[0.66rem] leading-relaxed text-clay-dark">
                      No IVR phone number is active. We will not publish a number until keypad
                      booking is live and tested.
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <Sparkles className="size-3.5" /> {content.quickTitle}
            </p>
            <div className="mt-3 space-y-2">
              <Link
                href="/bookings"
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-cream/40 px-3.5 py-2.5 text-xs font-semibold text-forest transition hover:border-forest/25"
              >
                {content.helpCta}
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/explore"
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-cream/40 px-3.5 py-2.5 text-xs font-semibold text-forest transition hover:border-forest/25"
              >
                {content.bookingsCta}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-stone">
              <LockKeyhole className="size-3.5" /> Safety reminder
            </p>
            <ul className="mt-2.5 space-y-2 text-[0.68rem] leading-relaxed text-stone">
              <li className="flex gap-2">
                <KeyRound className="mt-0.5 size-3.5 shrink-0 text-clay" />
                Never share a bank OTP, UPI PIN, card PIN or password.
              </li>
              <li className="flex gap-2">
                <HandCoins className="mt-0.5 size-3.5 shrink-0 text-forest" />
                Pay the owner directly, only after reviewing the final bill.
              </li>
              <li className="flex gap-2">
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-sky" />
                Report an issue from the booking if the work or amount does not match.
              </li>
            </ul>
          </Card>

          <div className="rounded-2xl border border-forest/10 bg-forest/5 p-4">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest">
              <PhoneCall className="size-3.5" /> Phone booking
            </p>
            <p className="mt-1.5 text-[0.66rem] leading-relaxed text-forest/75">
              IVR keypad booking is coming soon. There is no working phone number for it yet.
            </p>
            <Link href="#ivr" className={buttonStyles("outline", "sm", "mt-2.5")}>
              Read the update
            </Link>
          </div>
        </aside>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-2xl text-forest">{content.faqTitle}</h2>
        <div className="mt-3 divide-y divide-line/70">
          {content.faqs.map((faq) => (
            <details key={faq.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-forest">
                {faq.q}
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-stone transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-3xl text-[0.72rem] leading-relaxed text-stone">{faq.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
