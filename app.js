import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";
const VAPID_PUBLIC_KEY = "BJ8N8a64oyzKOAgPPRhRU9jiP3XQoe4cXA16ku1Iuf_Mo4Ll2-jtYBLDyx69hZa5YhX1yN0hJ9NZRCX-bqIrHa4";
const serviceWorkerReady = "serviceWorker" in navigator
  ? navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).catch(error => { console.error("Service worker:", error); return null; })
  : Promise.resolve(null);
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});

const $ = (selector) => document.querySelector(selector);

// Mersal interface language. User-generated messages, names, and statuses are never translated.
const mersalTranslations = {
  "الملف الشخصي":"Profile","الحساب":"Account",
  "عام":"General","الخصوصية":"Privacy","الدردشات":"Chats","المساعدة والدعم":"Help & Support","مركز المساعدة":"Help Center","كيف يمكننا مساعدتك؟":"How can we help?","إرسال طلب مساعدة جديد":"Send a new support request","طلباتي السابقة ومتابعتها":"My previous requests","صندوق الدعم للمطور":"Developer support inbox","الأسئلة الشائعة":"Frequently asked questions","كيف أتابع طلبي؟":"How can I track my request?","كيف أبلغ عن مشكلة؟":"How do I report a problem?","كيف أبلغ عن إساءة؟":"How do I report abuse?","كيف أقترح ميزة؟":"How do I suggest a feature?","هل يمكنني متابعة رد المطور؟":"Can I follow the developer's reply?","إرسال طلب جديد":"Send a new request","رجوع للمساعدة والدعم":"Back to Help & Support","نوع الطلب":"Request type","مساعدة عامة":"General help","مشكلة تقنية":"Technical issue","الإبلاغ عن خلل":"Report a bug","الإبلاغ عن إساءة أو محتوى":"Report abuse or content","اقتراح ميزة":"Suggest a feature","أخرى":"Other","عنوان الطلب":"Request subject","اكتب عنوانًا مختصرًا":"Enter a short subject","التفاصيل":"Details","اشرح طلبك أو المشكلة بالتفصيل":"Describe your request or issue","إرسال الطلب":"Submit request","طلباتي السابقة":"My previous requests","تصفية الطلبات حسب الحالة":"Filter requests by status","كل الطلبات":"All requests","جديدة":"New","قيد المراجعة":"In review","تم الحل":"Resolved","مغلقة":"Closed","تحديث الطلبات":"Refresh requests","جميع طلبات المستخدمين":"All user requests","تفاصيل الطلب":"Request details","رجوع إلى الطلبات":"Back to requests","تحديث حالة الطلب":"Update request status","جديد":"New","مغلق":"Closed","حفظ الحالة":"Save status","المراسلات":"Messages","اكتب ردًا":"Write a reply","اكتب رسالتك لفريق الدعم":"Write your message to support","إرسال الرد":"Send reply","المطور":"Developer","أنت":"You","لا توجد طلبات حتى الآن.":"No requests yet.","لا توجد طلبات تطابق التصفية.":"No requests match this filter.","لا توجد مراسلات بعد.":"No messages yet.","رقم الطلب":"Ticket number","الحالة":"Status","تم إرسال طلبك بنجاح.":"Your request was submitted successfully.","تم إرسال الرد.":"Your reply was sent.","تم تحديث حالة الطلب.":"Request status updated.","تعذر تحميل طلبات الدعم: ":"Could not load support requests: ","تعذر تحميل تفاصيل الطلب: ":"Could not load request details: ","تعذر إرسال الطلب: ":"Could not submit request: ","تعذر إرسال الرد: ":"Could not send reply: ","تعذر تحديث الحالة: ":"Could not update status: ","لم يتم العثور على الطلب.":"Request not found.","طلب جديد":"New request","قيد المراجعة":"In review","تم الحل":"Resolved","مغلق":"Closed","جارٍ تحميل الطلبات…":"Loading requests…","جارٍ تحميل المراسلات…":"Loading messages…","طلبات الدعم":"Support requests","الرد من المطور":"Reply from developer","رد من المستخدم":"User reply","لا يمكن فتح هذا الطلب.":"This request cannot be opened.","حجم نص الرسائل داخل المحادثة":"Message text size in chats","عادي":"Normal","كبير":"Large","كبير جدًا":"Extra large","يؤثر هذا الخيار في نصوص الرسائل داخل المحادثات فقط.":"This affects message text inside chats only.","إرسال الرسالة بالضغط على Enter":"Press Enter to send messages","عند التفعيل، يرسل Enter الرسالة، ويضيف Shift مع Enter سطرًا جديدًا.":"When enabled, Enter sends the message; Shift + Enter inserts a new line.","تأكيد قبل حذف الرسائل":"Confirm before deleting messages","عند إيقافه، تُحذف الرسائل مباشرة عند اختيار الحذف.":"When disabled, messages are deleted immediately when you choose Delete.","إظهار وقت الرسائل":"Show message timestamps","يؤدي إيقاف هذا الخيار إلى إخفاء أوقات الرسائل داخل المحادثة فقط.":"Turn this off to hide timestamps inside chats only.","تقليل المسافات بين الرسائل":"Compact message spacing","يعرض الرسائل بمسافات أقل لتسهيل استعراض المحادثات الطويلة.":"Use tighter spacing to make long conversations easier to browse.","تم تشغيل إظهار وقت الرسائل.":"Message timestamps are now shown.","تم إيقاف إظهار وقت الرسائل.":"Message timestamps are now hidden.","تم تفعيل العرض المضغوط للرسائل.":"Compact message spacing enabled.","تم إيقاف العرض المضغوط للرسائل.":"Compact message spacing disabled.","آخر ظهور":"Last seen","حالة الاتصال":"Online status","صورة الملف الشخصي":"Profile photo","النبذة":"About",
  "من يستطيع رؤية صورة ملفك الشخصي":"Who can see your profile photo","من يستطيع رؤية نبذتك":"Who can see your About",
  "نبذة عني":"About me","اكتب نبذة قصيرة عنك":"Write a short About","لا توجد نبذة متاحة.":"No About available.",
  "تتحكم هذه الإعدادات في ظهور صورة حسابك للأشخاص الآخرين.":"These settings control who can see your profile photo.",
  "الأشخاص الذين لن يتمكنوا من رؤية صورة ملفك الشخصي.":"People who cannot see your profile photo.",
  "تتحكم هذه الإعدادات في ظهور النبذة الموجودة في بيانات حسابك.":"These settings control who can see your About.",
  "الأشخاص الذين لن يتمكنوا من رؤية نبذتك.":"People who cannot see your About.",
  "يمكن أن تصل النبذة إلى 200 حرف.":"Your About can be up to 200 characters.",
  "الصورة الشخصية":"Profile photo","الصورة الشخصية لـ ":"Profile photo of ",
  "النبذة يجب ألا تتجاوز 200 حرفًا.":"About must be 200 characters or fewer.",
  "من يستطيع رؤية آخر ظهورك":"Who can see your last seen",
  "من يستطيع رؤية أنك متصل الآن":"Who can see when you're online",
  "الخصوصية متبادلة مثل واتساب: إذا أخفيت آخر ظهورك عن شخص، فلن تتمكن من رؤية آخر ظهوره أو حالة اتصاله. ويجب أن تسمح إعدادات الطرفين بذلك.":"Mutual privacy, like WhatsApp: if you hide your last seen from someone, you cannot see their last seen or online status. Both users' settings must allow it.",
  "اختر الجميع للسماح برؤية اتصالك، أو «مثل آخر ظهور» لتطبيق الجمهور نفسه. لا يمكن تجاوز قاعدة الخصوصية المتبادلة.":"Choose Everyone to share when you're online, or Same as last seen to use the same audience. Mutual privacy still applies.",
  "عند إيقافها لن ترسل أو ترى مؤشرات القراءة في المحادثات الفردية، ولن تعرف من شاهد حالاتك. تبقى مؤشرات القراءة في المجموعات مفعّلة كما في واتساب.":"When off, you won't send or see read receipts in individual chats or see who viewed your statuses. Group read receipts remain on, as in WhatsApp.",
  "يُمنع إدخالك إلى المجموعات ممن لا تسمح لهم إعداداتك أو تستثنيهم.":"People not allowed by your settings or exclusions cannot add you to groups.",
  "تُطبّق تغييرات جمهور الحالات على الحالات الجديدة فقط، ولا تغيّر جمهور الحالات المنشورة سابقًا. هذه الخيارات الثلاثة تطابق خيارات جمهور الحالة في واتساب.":"Audience changes apply only to new statuses, not statuses already posted. These three choices match WhatsApp status privacy.",
  "يظهر إشعار برسالة جديدة دون عرض محتوى الرسالة.":"Notifications show that a new message arrived without revealing its content.",
  "مؤشرات قراءة الرسائل":"Read receipts","من يستطيع إضافتي إلى المجموعات":"Who can add me to groups",
  "إخفاء نص الرسائل في الإشعارات":"Hide message text in notifications","من يستطيع مشاهدة حالاتي":"Who can view my statuses",
  "الأشخاص المحظورون":"Blocked users","حفظ المستثنين":"Save exclusions","الجميع":"Everyone",
  "جهات اتصالي":"My contacts","لا أحد":"Nobody","جهات اتصالي باستثناء أشخاص":"My contacts except…",
  "من يستطيع رؤية حالة اتصالي":"Who can see when I'm online","مثل آخر ظهور":"Same as last seen",
  "المشاركة مع أشخاص محددين فقط":"Only share with selected contacts",
  "الأشخاص الذين لن يظهر لهم آخر ظهورك.":"People who cannot see your last seen.",
  "الأشخاص الذين لا تريد السماح لهم بإضافتك إلى المجموعات.":"People who cannot add you to groups.",
  "حدد الأشخاص الذين سيتمكنون من مشاهدة حالاتك فقط.":"Choose who can see your statuses.",
  "حدد الأشخاص الذين لن يتمكنوا من مشاهدة حالاتك.":"Choose who cannot see your statuses.",
  "حفظ جمهور الحالات":"Save status audience","تم حفظ الاستثناءات.":"Exclusions saved.",
  "لا توجد جهات اتصال في مرسال للاختيار منها.":"No Mersal contacts are available to choose.",
  "أوقفت مؤشرات القراءة؛ لذلك لا يمكنك مشاهدة من شاهد حالتك.":"Read receipts are off, so you can't see who viewed your status.",
  "إذا أخفيت آخر ظهورك عن شخص، فلن تتمكن من رؤية آخر ظهوره أو حالة اتصاله.":"If you hide your last seen from someone, you can't see their last seen or online status.",
  "عند إيقافها لن ترسل أو ترى مؤشرات القراءة في المحادثات الفردية. تبقى مؤشرات القراءة في المجموعات مفعّلة.":"When off, you won't send or see read receipts in individual chats. Group read receipts stay on.",
  "حدد الأشخاص الذين لا تريد أن يشاهدوا حالاتك.":"Choose people who should not see your statuses.",
  "رسالة جديدة":"New message","مقروء":"Read","مقروء من ":"Read by ","حالة الظهور مخفية":"Presence hidden",
  " إخفاء نص الرسائل في الإشعارات":" Hide message text in notifications",
  " مؤشرات قراءة الرسائل":" Read receipts","إلغاء الحظر":"Unblock","لا يوجد أشخاص محظورون.":"No blocked users.",
  "الأشخاص المستثنون من مشاهدة الحالات":"People excluded from viewing statuses",
  "عام":"General","مرسال":"Mersal","، جاري تحديث حالة الظهور":"; updating presence",
  "عرض المرفق داخل المحادثة":"View attachment in chat","إغلاق العرض":"Close viewer","ترجيع 10 ثوانٍ":"Rewind 10 seconds","ترجيع 10 ثوانٍ في ":"Rewind 10 seconds in ",
  "تشغيل":"Play","تشغيل ":"Play ","تقديم 10 ثوانٍ":"Forward 10 seconds","تقديم 10 ثوانٍ في ":"Forward 10 seconds in ","موضع التشغيل في ":"Playback position in ",
  "إيقاف مؤقت":"Pause","إيقاف ":"Stop ","الفيديو المرفق داخل المحادثة":"Video attached in chat","تشغيل الملف الصوتي داخل مرسال":"Play audio file in Mersal",
  "معاينة الملف داخل مرسال: ":"Preview file in Mersal: ","رجعت من Google، لكن مرسال لم يستلم جلسة الدخول. هذا يعني أن إكمال تسجيل الدخول تعثّر بعد الرجوع من Google.":"You returned from Google, but Mersal did not receive the sign-in session. Sign-in could not be completed after returning from Google.",
  "مرحبًا بك في مرسال · متصل الآن":"Welcome to Mersal · Online","تعذر تحميل بعض بيانات الحساب: ":"Could not load some account details: ","تعذر تحديث آخر ظهور:":"Could not update last seen:",
  "آخر ظهور اليوم الساعة ":"Last seen today at ","آخر ظهور أمس الساعة ":"Last seen yesterday at ","آخر ظهور ":"Last seen "," الساعة ":" at ",
  "جارٍ تحميل عدد الأعضاء":"Loading member count","، ":" , ","تعذر تحميل عدد أعضاء المجموعة:":"Could not load group member count:",
  "تعذر تحديث حالة الاتصال: ":"Could not update connection status: ","إيقاف إشعارات الهاتف":"Disable phone notifications",
  "إشعارات الهاتف مفعّلة على هذا الجهاز.":"Phone notifications are enabled on this device.",
  "الإشعارات متوقفة على هذا الجهاز. يمكنك تشغيلها من هنا.":"Notifications are off on this device. You can enable them here.",
  "يمكنك تشغيل إشعارات الرسائل أو إيقافها من هذا الزر.":"Use this button to turn message notifications on or off.",
  "تعذر تجهيز خدمة الإشعارات.":"Could not prepare the notification service.","لم يتم إيقاف اشتراك الإشعارات. حاول مرة أخرى.":"The notification subscription was not disabled. Try again.",
  "أضف مرسال إلى الشاشة الرئيسية أولًا، ثم افتحه من الأيقونة وشغّل الإشعارات من هنا.":"First add Mersal to your Home Screen, then open it from its icon and enable notifications here.",
  "الإشعارات محظورة من إعدادات الجهاز. اسمح بها لمرسال من إعدادات الإشعارات ثم أعد المحاولة.":"Notifications are blocked in device settings. Allow notifications for Mersal in Settings, then try again.",
  "لم يتم السماح بالإشعارات. يمكنك تفعيلها من إعدادات الجهاز.":"Notifications were not allowed. You can enable them in device settings.",
  "تعذر تغيير إعداد الإشعارات: ":"Could not change notification settings: ","الإشعارات، ":"Notifications, "," غير مقروءة":" unread",
  "تعذر فتح المحادثة من الإشعار: ":"Could not open chat from notification: ","، مجموعة":", group","وصلك إشعار جديد، لكن تعذر تحديث القائمة: ":"You received a new notification, but the list could not be refreshed: ",
  "تعذر تحديث الإشعارات: ":"Could not update notifications: ","تم التحديد.":"Selected.","تم حذف الحساب نهائيًا.":"Account permanently deleted.",
  "جارٍ فتح Google لتسجيل الدخول…":"Opening Google sign-in…","تعذر بدء تسجيل الدخول: ":"Could not start sign-in: "," · متصل الآن":" · Online",
  "تعذر تحديث الحالات: ":"Could not refresh statuses: ","حالتي":"My status","اكتب حالتك":"Write your status","أضف وصفًا اختياريًا":"Add an optional description",
  "تم تحديث الحالات.":"Statuses updated.","نوع الملف لا يطابق نوع الحالة المختار.":"The file type does not match the selected status type.",
  "تم نشر الحالة.":"Status posted.","تعذر نشر الحالة: ":"Could not post status: ","انتهت صلاحية هذه الحالة.":"This status has expired.",
  "تعذر تسجيل مشاهدة الحالة:":"Could not record status view:","تعذر فتح الحالة.":"Could not open status.","تعذر تحميل المشاهدات.":"Could not load views.",
  "تعذر حذف ملف الحالة:":"Could not delete status file:","تم حذف الحالة.":"Status deleted.","تعذر حذف الحالة: ":"Could not delete status: ",
  ", مجموعة":", group","تعذر إنشاء المحادثة: ":"Could not create conversation: ","تعذر استرجاع المحادثة: ":"Could not retrieve conversation: ",
  "الاتصال المباشر بالرسائل غير مستقر. استخدم زر تحديث الرسائل للمزامنة.":"Live message connection is unstable. Use Refresh messages to sync.",
  "تعذر تجهيز المكالمات الصوتية لهذه المحادثة.":"Could not prepare voice calls for this conversation.","لا يمكن إرسال الرسائل بسبب الحظر.":"Messages cannot be sent because of a block.",
  "إلغاء الحظر":"Unblock user","تعذر تحميل العدد":"Could not load count","تعذر تحميل إعداد الإشعارات لهذه المحادثة.":"Could not load notification settings for this conversation.",
  "تشغيل إشعارات المحادثة":"Enable chat notifications","تعذر التحقق من صلاحية مشرف المجموعة:":"Could not verify group admin permissions:",
  "تعذر تحميل أعضاء المجموعة: ":"Could not load group members: ","تعذر تحميل أسماء الأعضاء.":"Could not load member names.",
  " (أنت)":" (You)","خيارات ":"Options ","، أنت":", you","إزالة صفة المشرف":"Remove admin role","تعيين مشرف":"Make admin","إزالة من المجموعة":"Remove from group",
  "هل تريد تعيين ":"Do you want to make "," مشرفًا في المجموعة؟":" a group admin?","هل تريد إزالة صفة المشرف عن ":"Do you want to remove admin privileges from ",
  "؟":"?","هل تريد إزالة ":"Do you want to remove "," من المجموعة؟":" from the group?","تأكيد الإجراء؟":"Confirm this action?",
  "تعذر تنفيذ الإجراء: ":"Could not complete action: ","تم تعيينه مشرفًا.":"Admin role assigned.","تمت إزالة صفة المشرف.":"Admin role removed.",
  "تعذرت إضافة الأعضاء: ":"Could not add members: ","تعذر تغيير اسم المجموعة: ":"Could not change group name: ",
  "سيتم حذف المجموعة نهائيًا من عند جميع الأعضاء، بما في ذلك الرسائل والملفات. لا يمكن التراجع. هل تريد المتابعة؟":"The group will be permanently deleted for all members, including messages and files. This cannot be undone. Continue?",
  "سيتم حذف المجموعة من قائمتك وإزالتك منها فقط. ستبقى المجموعة وباقي الرسائل متاحة للأعضاء الآخرين. هل تريد المتابعة؟":"The group will only be removed from your list and you will leave it. The group and its messages will remain available to other members. Continue?",
  "تم حذف المجموعة للجميع.":"Group deleted for everyone.","تم حذف المجموعة من عندك.":"Group removed from your account.",
  "تعذر حذف المجموعة: ":"Could not delete group: ","لن يتمكن هذا الشخص من مراسلتك أو الاتصال بك عبر مرسال. هل تريد حظره؟":"This person will no longer be able to message or call you on Mersal. Block them?",
  "تعذر تغيير الحظر: ":"Could not change block settings: ","المجموعة":"Group",
  "سيتم حذف ":"This will delete "," من قائمتك فقط. لن تُحذف لدى بقية المشاركين، وستظهر مجددًا عند وصول رسالة جديدة. هل تريد المتابعة؟":" from your list only. It will remain for other participants and reappear when a new message arrives. Continue?",
  "تم حذف الدردشة من قائمتك.":"Chat removed from your list.","تعذر حذف الدردشة: ":"Could not delete chat: ",
  "تعذر تغيير الإشعارات: ":"Could not change notifications: ","سيتم إخفاء رسائل هذه المحادثة من جهازك فقط، ولن تُحذف عند الطرف الآخر. هل تريد المتابعة؟":"Messages in this conversation will be hidden only on your device and will not be deleted for the other person. Continue?",
  "تم مسح المحادثة من جهازك.":"Chat cleared on your device.","تعذر مسح المحادثة: ":"Could not clear chat: ","مرسال - ":"Mersal - ",
  "آخر ":"Last "," رسالة":" message","تم حذف هذه الرسالة.":"This message was deleted.","[مرفق: ":"[Attachment: ","[مرفق]":"[Attachment]","أنت":"You",
  "تعذر تجهيز سجل المحادثة: ":"Could not prepare chat history: ","تعذر تجهيز قناة المكالمة:":"Could not prepare call channel:",
  "بيانات المكالمة غير مكتملة.":"Call details are incomplete.","قناة المكالمة غير جاهزة.":"Call channel is not ready.",
  "لا يوجد مشاركون متاحون في هذه المحادثة.":"There are no available participants in this conversation.","تحقق من إذن الميكروفون.":"Check microphone permission.",
  " يتصل بك صوتيًا.":" is calling you.","رفض أحد المشاركين المكالمة.":"A participant declined the call.","أحد المشاركين مشغول حاليًا.":"A participant is currently busy.",
  "تم الانضمام. جارٍ توصيل الصوت…":"Joined. Connecting audio…","تعذر تشغيل الصوت. تحقق من مستوى صوت الهاتف.":"Could not play audio. Check your phone volume.",
  "هل تريد حذف هذه الرسالة من محادثتك فقط؟":"Do you want to delete this message from your chat only?","تعذر حذف الرسالة لديك: ":"Could not delete your message: ",
  "يمكنك حذف رسائلك أنت لدى الجميع فقط.":"You can only delete your own messages for everyone.",
  "سيتم حذف محتوى الرسالة من محادثتك ومحادثة الطرف الآخر. هل تريد المتابعة؟":"The message content will be deleted from your chat and the other person's chat. Continue?",
  "تعذر حذف الرسالة لدى الجميع: ":"Could not delete message for everyone: ","لم يتم تحديث الرسالة.":"Message was not updated.","تعذر فتح المرفق.":"Could not open attachment.",
  "عرض الصورة داخل مرسال":"View image in Mersal","تشغيل الفيديو داخل مرسال":"Play video in Mersal","تشغيل الصوت داخل مرسال":"Play audio in Mersal",
  "عرض الملف داخل مرسال":"View file in Mersal","عرض الصورة ":"View image ","تشغيل الفيديو ":"Play video ","تشغيل الصوت ":"Play audio ","عرض الملف ":"View file ",
  " داخل المحادثة":" in chat","صورة مرفقة: ":"Attached image: ","خيارات الرسالة":"Message options","إغلاق الخيارات":"Close options",
  "تعذر نسخ الرسالة من هذا المتصفح.":"Could not copy the message in this browser.","الرد على: ":"Reply to: ","اكتب ردك على الرسالة المحددة.":"Write your reply to the selected message.",
  "حذف هذه الرسالة لدى الجميع":"Delete this message for everyone","حذف لدى الجميع، متاح لرسائلك أنت فقط":"Delete for everyone (your messages only)",
  "تعذر تحميل إعدادات إخفاء الرسائل: ":"Could not load message hiding settings: ","ردًا على: ":"In reply to: ",
  "اكتب الرسالة أولًا ثم اضغط مطولًا على زر الإرسال لجدولتها.":"Write your message first, then press and hold Send to schedule it.",
  "اكتب الرسالة أولًا.":"Write your message first.","اختر وقتًا لاحقًا من الوقت الحالي بدقيقة على الأقل.":"Choose a time at least one minute in the future.",
  "تمت جدولة الرسالة.":"Message scheduled.","تعذر تحميل الرسائل المجدولة: ":"Could not load scheduled messages: ",
  "تعذر إلغاء جدولة الرسالة: ":"Could not cancel scheduled message: ","ربما حان موعد إرسالها.":"It may be time to send it.",
  "تم إلغاء جدولة الرسالة.":"Scheduled message cancelled.","حجم الملف ":"File size "," أكبر من 50 ميغابايت.":" exceeds 50 MB.",
  "تعذر إرسال الملف ":"Could not send file ","اكتب رسالتك قبل الإرسال.":"Write your message before sending.","تعذر التحقق من الجلسة: ":"Could not verify session: ",
  "فشل تسجيل الدخول: ":"Sign-in failed: ",
"م":"M","الإعدادات":"Settings","التواصل مع المطور":"Contact the developer","محادثاتك الخاصة":"Your private chats",
  "ابحث في الرسائل":"Search messages","أعضاء المجموعة":"Group members","خيارات عضو المجموعة":"Group member options","إضافة أعضاء للمجموعة":"Add members to group",
  "الأشخاص المتاحون للإضافة":"People available to add","قائمة الرسائل المجدولة":"Scheduled message list","رسائل المحادثة":"Conversation messages",
  "إرسال رسالة":"Send a message","نص الرسالة":"Message text","الصفحة الرئيسية":"Home","نص الحالة أو وصف الوسائط":"Status text or media description",
  "عرض الحالة":"View status","مشاهدو الحالة":"Status viewers","اكتب الاسم للبحث":"Enter a name to search","الأشخاص":"People",
  "اكتب اسم المجموعة":"Enter a group name","اختيار أعضاء المجموعة":"Choose group members","المكالمة الصوتية":"Voice call",
  "تأكيد حذف الحساب":"Confirm account deletion","حذف حسابي":"Delete my account","إرفاق ملف":"Attach a file",
  "حذف الحساب نهائيًا":"Delete account permanently","للتأكيد، اكتب: حذف حسابي":"To confirm, type: Delete my account",
  "حذف الحساب نهائي ولا يمكن التراجع عنه. سيتم حذف بيانات حسابك ورسائلك ومحادثاتك الخاصة والملفات التي أرفقتها، كما ستُحذف المجموعات التي أنشأتها. ستُزال عضويتك ورسائلك من المجموعات الأخرى.":"Account deletion is permanent and cannot be undone. Your account data, messages, private conversations, and attached files will be deleted. Groups you created will also be deleted, and your membership and messages will be removed from other groups.",
"جارٍ التحقق من تسجيل الدخول…":"Checking sign-in…","جارٍ تجهيز مرسال…":"Loading Mersal…","إعادة المحاولة":"Try again",
  "تسجيل الدخول باستخدام Google":"Sign in with Google","إعدادات الحساب":"Account settings","اللغة":"Language","العربية":"Arabic","تم تغيير اللغة إلى العربية.":"Language changed to Arabic.","تم تغيير اللغة إلى الإنجليزية.":"Language changed to English.","مجموعة":"Group","الدردشة":"Chat","رسالة":"Message","حجم النص في مرسال":"Text size",
  "عادي":"Normal","كبير":"Large","كبير جدًا":"Extra large","يمكنك تكبير النص لتسهيل القراءة. يُحفظ اختيارك على هذا الجهاز.":"Increase text size for easier reading. Your choice is saved on this device.",
  "المظهر":"Appearance","حسب إعدادات الجهاز":"System default","داكن":"Dark","فاتح":"Light","اختر المظهر المريح لك. يُحفظ اختيارك على هذا الجهاز.":"Choose your preferred appearance. Your choice is saved on this device.",
  "تشغيل إشعارات الهاتف":"Enable phone notifications","لتصلك الرسائل خارج مرسال، فعّل إشعارات الهاتف.":"Enable phone notifications to receive messages when Mersal is not open.",
  "التواصل مع المطور عبر":"Contact the developer","من تطوير fahed alzereeni":"Developed by fahed alzereeni","رجوع إلى الإعدادات":"Back to settings",
  "الاسم الظاهر للآخرين":"Name shown to others","البريد الإلكتروني":"Email address","البريد مرتبط بحساب Google ولا يمكن تغييره من هنا.":"This email is linked to your Google account and cannot be changed here.",
  "حفظ بيانات الحساب":"Save account details","تسجيل الخروج":"Sign out","حذف الحساب":"Delete account","إنستغرام":"Instagram","فيسبوك":"Facebook","واتساب":"WhatsApp",
  "إضافة حالة":"Add status","تحديث الحالات":"Refresh statuses","الإشعارات":"Notifications","إغلاق":"Close","تحديد الكل كمقروء":"Mark all as read","دردشة جديدة":"New chat",
  "اختر شخصًا من القائمة لبدء محادثة خاصة.":"Choose someone from the list to start a private chat.","العودة للمحادثات":"Back to chats","اتصال صوتي":"Voice call",
  "تحديث الرسائل":"Refresh messages","الرسائل المجدولة":"Scheduled messages","إغلاق المعلومات":"Close details","الاسم":"Name","الحالة":"Status","تاريخ الإنشاء":"Created",
  "عدد الرسائل":"Message count","البحث في الرسائل":"Search messages","تنزيل سجل المحادثة":"Download chat history","كتم إشعارات المحادثة":"Mute chat notifications",
  "مسح المحادثة من جهازي":"Clear chat on this device","حظر الشخص":"Block user","إضافة أعضاء":"Add members","حذف الدردشة من عندي":"Delete chat for me",
  "اسم المجموعة الجديد":"New group name","حفظ اسم المجموعة":"Save group name","مغادرة المجموعة":"Leave group","حذف المجموعة للجميع":"Delete group for everyone",
  "اكتب كلمة لعرض النتائج.":"Type a word to view results.","ابحث عن شخص لإضافته":"Find someone to add","إضافة المحددين":"Add selected",
  "وقت إرسال الرسالة":"Message send time","اختر التاريخ والوقت، وسيتم إرسال الرسالة تلقائيًا حتى لو أغلقت مرسال.":"Choose a date and time. The message will be sent automatically, even if you close Mersal.",
  "جدولة الرسالة":"Schedule message","إلغاء الرد":"Cancel reply","اكتب رسالتك":"Write your message","إرفاق":"Attach","إرسال":"Send",
  "الرئيسية":"Home","الحالات":"Statuses","نص":"Text","صورة":"Photo","فيديو":"Video","نشر الحالة":"Post status","حذف الحالة":"Delete status",
  "محادثة جديدة":"New conversation","مجموعة جديدة":"New group","ابحث عن شخص":"Search for a person","اسم المجموعة":"Group name","ابحث عن أعضاء":"Search members","إنشاء المجموعة":"Create group",
  "جارٍ تجهيز المكالمة…":"Preparing call…","تشغيل صوت المكالمة":"Play call audio","الرد على المكالمة":"Answer call","رفض المكالمة":"Decline call","كتم الميكروفون":"Mute microphone","إنهاء المكالمة":"End call",
  "إلغاء":"Cancel","إرسال الصور":"Send photos","إرسال الفيديوهات":"Send videos","إرسال الملفات":"Send files","اسم الشخص":"Person's name","اكتب اسم المجموعة.":"Enter a group name.",
  "اكتب اسم المجموعة":"Enter a group name","اكتب اسم الشخص":"Enter a person's name","اكتب الاسم للبحث":"Enter a name to search","اكتب رسالتك هنا…":"Write your message…",
  "البحث":"Search","إضافة المحددين":"Add selected","حفظ":"Save","مراسلة":"Message","منشئ المجموعة":"Group creator","مشرف":"Admin","عضو":"Member",
  "متصل الآن":"Online","آخر ظهور غير متوفر":"Last seen unavailable","غير متوفر":"Unavailable","غير مسجل الدخول":"Signed out","مستخدم مرسال":"Mersal user",
  "رسالة صوتية":"Voice message","صورة مرفقة":"Attached image","ملف مرفق":"Attached file","مرفق":"Attachment","ملف":"File","صورة":"Photo","فيديو":"Video",
  "نسخ الرسالة":"Copy message","الرد على الرسالة":"Reply to message","حذف الرسالة لدى الجميع":"Delete message for everyone","حذف الرسالة لدي فقط":"Delete message for me",
  "حذف لدى الجميع":"Delete for everyone","حذف لدي":"Delete for me","إلغاء الجدولة":"Cancel schedule","لا توجد إشعارات بعد.":"No notifications yet.",
  "لا توجد حالات حاليًا.":"No statuses yet.","لا توجد رسائل مجدولة في هذه المحادثة.":"No scheduled messages in this chat.","لا توجد محادثات بعد.":"No conversations yet.",
  "لا يوجد أشخاص بهذا الاسم.":"No people found with that name.","لا يوجد أشخاص متاحون للإضافة.":"No people available to add.","لا توجد إجراءات متاحة لهذا العضو.":"No actions available for this member.",
  "هذه بداية المحادثة. أرسل أول رسالة.":"This is the beginning of the conversation. Send the first message.","أرسل رسالة جديدة":"Send a new message",
  "تم الحفظ.":"Saved.","تم الإرسال.":"Sent.","تم الحفظ":"Saved","تم الحذف.":"Deleted.","تم الحذف":"Deleted","تم نسخ الرسالة.":"Message copied.",
  "تم إنشاء المجموعة.":"Group created.","تمت إضافة الأعضاء.":"Members added.","تمت إزالة العضو.":"Member removed.","تم تغيير اسم المجموعة.":"Group name updated.",
  "تم تسجيل الدخول. يمكنك بدء محادثة جديدة.":"Signed in. You can start a new conversation.","تم تسجيل الخروج.":"Signed out.",
  "تم تشغيل إشعارات الهاتف على هذا الجهاز.":"Phone notifications enabled on this device.","تم إيقاف إشعارات الهاتف على هذا الجهاز.":"Phone notifications disabled on this device.",
  "تم تشغيل إشعارات المحادثة.":"Chat notifications enabled.","تم كتم إشعارات المحادثة.":"Chat notifications muted.","تم حظر الشخص.":"User blocked.","تم إلغاء الحظر.":"User unblocked.",
  "تعذر التشغيل":"Playback failed","تعذر إرسال إشارة المكالمة.":"Could not send the call signal.","تعذر الاتصال بقناة المكالمة.":"Could not connect to the call channel.",
  "المكالمات الصوتية تحتاج متصفحًا آمنًا يدعم الميكروفون.":"Voice calls require a secure browser that supports the microphone.",
  "المكالمة الصوتية متصلة.":"Voice call connected.","الميكروفون مكتوم.":"Microphone is muted.","الميكروفون يعمل.":"Microphone is on.",
  "تشغيل الميكروفون":"Unmute microphone","مغادرة المكالمة":"Leave call","مشارك في المكالمة":"Call participant","أحد المشاركين":"A participant",
  "جارٍ الاتصال بالمشاركين…":"Connecting to participants…","تم الاتصال. اضغط تشغيل صوت المكالمة لسماع الطرف الآخر.":"Connected. Select Play call audio to hear the other person.",
  "تم تشغيل صوت المكالمة.":"Call audio started.","لم يصل الصوت من الطرف الآخر بعد.":"Audio from the other person has not arrived yet.",
  "حدثت مشكلة في الاتصال الصوتي.":"A voice connection problem occurred.","الاتصال بأحد المشاركين غير مستقر. تحقق من الشبكة.":"Connection to a participant is unstable. Check your network.",
  "اكتب رسالتك أولًا.":"Write your message first.","اكتب نص الحالة أولًا.":"Enter status text first.","اختر صورة أو فيديو أولًا.":"Choose a photo or video first.",
  "اختر شخصًا واحدًا على الأقل.":"Choose at least one person.","اختر شخصًا واحدًا على الأقل لإنشاء المجموعة.":"Choose at least one person to create the group.",
  "اسم المجموعة يجب أن يتكون من حرفين على الأقل.":"The group name must contain at least two characters.","الاسم يجب أن يكون بين حرفين و40 حرفًا.":"The name must be between 2 and 40 characters.",
  "لا يمكنك إرسال رسائل في هذه المحادثة بسبب الحظر.":"You cannot send messages in this chat because of a block.",
  "لا يمكنك إرسال مرفقات في هذه المحادثة بسبب الحظر.":"You cannot send attachments in this chat because of a block.",
  "لا يمكنك جدولة رسائل في هذه المحادثة بسبب الحظر.":"You cannot schedule messages in this chat because of a block.",
  "لا تملك صلاحية تغيير الاسم.":"You do not have permission to change the name.","هذا الشخص حظرك":"This person has blocked you",
  "حاول مرة أخرى.":"Please try again.","خطأ غير معروف":"Unknown error","رفض Google الطلب":"Google declined the request",
  "لم يتم تسجيل الدخول. يمكنك المحاولة مرة أخرى باستخدام Google.":"You are not signed in. You can try again using Google.",
  "إشعارات الهاتف غير مدعومة":"Phone notifications are not supported","هذا المتصفح لا يدعم إشعارات الهاتف.":"This browser does not support phone notifications.",
  "الإشعارات محظورة من إعدادات الجهاز. اسمح بها لمرسال من إعدادات الإشعارات.":"Notifications are blocked in your device settings. Allow them for Mersal in notification settings.",
  "لا توجد نتائج ضمن الرسائل المحمّلة حاليًا.":"No results in the messages currently loaded.","لم يشاهدها أحد بعد.":"No one has viewed it yet.",
  "حجم الملف أكبر من 50 ميغابايت.":"The file is larger than 50 MB.","أكبر من 50 ميغابايت.":"Larger than 50 MB.",
  "هذا النوع من الملفات لا يدعم المعاينة داخل مرسال حاليًا. لم يتم فتحه في تطبيق أو موقع خارجي.":"This file type cannot be previewed in Mersal yet. It was not opened in an external app or website.",
  "تم تجهيز سجل المحادثة.":"Chat history is ready.","جارٍ التحميل…":"Loading…","جارٍ حفظ إعدادات الحساب…":"Saving account settings…",
  "جارٍ رفع ":"Uploading ","موعد الإرسال: ":"Scheduled for: ","عدد الأعضاء ":"Members: ","عدد النتائج: ":"Results: ",
  "آخر ظهور غير متوفر":"Last seen unavailable","متصل الآن":"Online","غير مقروء: ":"Unread: ","مقروء: ":"Read: ",
  "صورة الحالة من ":"Status photo from ","فيديو الحالة من ":"Status video from ","إشعار جديد من ":"New notification from ",
  "تعذر تحميل الرسائل: ":"Could not load messages: ","تعذر إرسال الرسالة: ":"Could not send message: ","تعذر إنشاء المجموعة: ":"Could not create group: ",
  "تعذرت جدولة الرسالة: ":"Could not schedule message: ","تعذر تحميل الحالات: ":"Could not load statuses: ","تعذر تحميل الإشعارات: ":"Could not load notifications: ",
  "تعذر بدء المكالمة: ":"Could not start call: ","تعذر الرد على المكالمة: ":"Could not answer call: ","تعذر حفظ الاسم: ":"Could not save name: ",
  "تعذر حذف الحساب: ":"Could not delete account: ","تعذر تسجيل الخروج: ":"Could not sign out: ","تعذر فتح المحادثة: ":"Could not open conversation: "
};
const mersalOriginalText = new WeakMap();
const mersalOriginalAttributes = new WeakMap();
const mersalSkipTranslation = "#messages,#status-list,#conversation-list,#people-list,#group-people-list,#group-add-people,#group-member-list,#scheduled-messages-list,#conversation-search-results,#notifications-list,#conversation-info-name,#conversation-info-status,#group-member-options-name,#message-schedule-preview,#replying-to-text,[data-no-translate],input,textarea";
function mersalShouldSkip(node) {
  const parent=node.parentElement;
  return !parent||Boolean(parent.closest(mersalSkipTranslation));
}
function mersalTranslateValue(value) {
  if(Object.prototype.hasOwnProperty.call(mersalTranslations,value))return mersalTranslations[value];
  const prefix=Object.keys(mersalTranslations).filter(key=>key.endsWith(" ")&&value.startsWith(key)).sort((a,b)=>b.length-a.length)[0];
  if(prefix)return mersalTranslations[prefix]+value.slice(prefix.length);
  const suffix=Object.keys(mersalTranslations).filter(key=>key.startsWith(" ")&&value.endsWith(key)).sort((a,b)=>b.length-a.length)[0];
  if(suffix)return value.slice(0,-suffix.length)+mersalTranslations[suffix];
  return value.replace(/،/g,",").replace(/؟/g,"?");
}
function mersalTranslateTextNode(node, language) {
  if(mersalShouldSkip(node))return;
  let state=mersalOriginalText.get(node);
  if(!state){state={original:node.nodeValue,lastApplied:null};mersalOriginalText.set(node,state);}
  else if(node.nodeValue!==state.lastApplied){state.original=node.nodeValue;}
  const next=language==="en"?mersalTranslateValue(state.original):state.original;
  if(node.nodeValue!==next){state.lastApplied=next;node.nodeValue=next;}else state.lastApplied=next;
}
function mersalTranslateAttributes(element, language) {
  if(element.matches?.(mersalSkipTranslation))return;
  for(const attr of ["aria-label","aria-description","placeholder","title","alt"]){
    if(!element.hasAttribute(attr))continue;
    let originals=mersalOriginalAttributes.get(element);
    if(!originals){originals={};mersalOriginalAttributes.set(element,originals);}
    const current=element.getAttribute(attr);
    let state=originals[attr];
    if(!state){state={original:current,lastApplied:null};originals[attr]=state;}
    else if(current!==state.lastApplied){state.original=current;}
    const next=language==="en"?mersalTranslateValue(state.original):state.original;
    if(current!==next)element.setAttribute(attr,next);
    state.lastApplied=next;
  }
}
function mersalTranslateTree(root=document) {
  const language=localStorage.getItem("mersal-language")==="en"?"en":"ar";
  if(root.nodeType===Node.TEXT_NODE){mersalTranslateTextNode(root,language);return;}
  if(root.nodeType===Node.ELEMENT_NODE)mersalTranslateAttributes(root,language);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;while((node=walker.nextNode()))mersalTranslateTextNode(node,language);
  if(root.querySelectorAll)root.querySelectorAll("*").forEach(element=>mersalTranslateAttributes(element,language));
}
function applyMersalLanguage(language, persist=true) {
  const chosen=language==="en"?"en":"ar";
  if(persist)localStorage.setItem("mersal-language",chosen);
  document.documentElement.lang=chosen;
  document.documentElement.dir=chosen==="ar"?"rtl":"ltr";
  document.documentElement.dataset.language=chosen;
  mersalTranslateTree();
  const selector=document.querySelector("#settings-language");
  if(selector&&selector.value!==chosen)selector.value=chosen;
}
applyMersalLanguage(localStorage.getItem("mersal-language")||"ar",false);
const mersalLanguageObserver=new MutationObserver(records=>{
  const language=localStorage.getItem("mersal-language")==="en"?"en":"ar";
  for(const record of records){
    if(record.type==="characterData")mersalTranslateTextNode(record.target,language);
    else for(const node of record.addedNodes)if(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.TEXT_NODE)mersalTranslateTree(node);
    if(record.type==="attributes"&&record.target.nodeType===Node.ELEMENT_NODE)mersalTranslateAttributes(record.target,language);
  }
});
mersalLanguageObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["aria-label","aria-description","placeholder","title","alt"]});
const authPanel = $("#auth-panel");
const workspace = $("#workspace");
const account = $("#account");
const status = $("#status");
const startupRetryButton = $("#startup-retry");
function finishStartup() {
  if (window.__mersalStartupTimer) window.clearTimeout(window.__mersalStartupTimer);
  if (startupRetryButton) startupRetryButton.hidden = true;
}
const loginButton = $("#google-login");
const bottomNavigation = $("#bottom-navigation");
const homeTabButton = $("#home-tab");
const settingsTabButton = $("#settings-tab");
const statusTabButton = $("#status-tab");
const statusView = $("#status-view");
const statusList = $("#status-list");
const statusComposerPanel = $("#status-composer-panel");
const statusViewerPanel = $("#status-viewer-panel");
const statusTextInput = $("#status-text-input");
const statusImageInput = $("#status-image-input");
const statusVideoInput = $("#status-video-input");
const settingsPanel = $("#settings-panel");
const developerContactPanel = $("#developer-contact-panel");
const openDeveloperContactButton = $("#open-developer-contact");
const closeDeveloperContactButton = $("#close-developer-contact");
let developerContactReturnFocus = null;
const DEVELOPER_USER_ID = "62fa5885-8d7c-4379-95e6-a8031e4f73ab";
const openHelpSupportButton = $("#open-help-support");
const helpSupportPanel = $("#help-support-panel");
const closeHelpSupportButton = $("#close-help-support");
const supportHomeView = $("#support-home-view");
const supportFormView = $("#support-form-view");
const supportRequestsView = $("#support-requests-view");
const supportAdminView = $("#support-admin-view");
const supportThreadView = $("#support-thread-view");
const supportAdminButton = $("#support-admin-button");
const supportRequestForm = $("#support-request-form");
const supportAttachmentInput = $("#support-attachment");
const supportReplyForm = $("#support-reply-form");
const supportAdminFilter = $("#support-admin-filter");
const supportStatusSelect = $("#support-status-select");
const supportAdminStatusTools = $("#support-admin-status-tools");
let supportRealtimeChannel = null;
let activeSupportRequest = null;
let supportThreadOrigin = "requests";
let supportReturnFocus = null;
const supportStatusLabels = {new:"جديد",in_progress:"قيد المراجعة",resolved:"تم الحل",closed:"مغلق"};
const supportCategoryLabels = {help:"مساعدة عامة",technical:"مشكلة تقنية",bug:"الإبلاغ عن خلل",abuse:"الإبلاغ عن إساءة أو محتوى",suggestion:"اقتراح ميزة",other:"أخرى"};
const isMersalDeveloper = () => currentUser?.id === DEVELOPER_USER_ID;
const settingsForm = $("#settings-form");
const displayNameInput = $("#settings-display-name");
const profileSettingsView = $("#profile-settings-view");
const openProfileSettingsButton = $("#open-profile-settings");
const backProfileSettingsButton = $("#back-profile-settings");
const profilePhotoInput = $("#profile-photo-input");
const profilePhotoPreview = $("#profile-photo-preview");
const profilePhotoPlaceholder = $("#profile-photo-placeholder");
const chooseProfilePhotoButton = $("#choose-profile-photo");
const removeProfilePhotoButton = $("#remove-profile-photo");
let currentProfilePhotoPath = null;
let currentProfilePhotoExternal = false;
const textSizeSelect = $("#settings-text-size");
const themeSelect = $("#settings-theme");
const settingsLanguageSelect = $("#settings-language");
const settingsEmail = $("#settings-email");
const settingsHome = $("#settings-home");
const generalSettingsView = $("#general-settings-view");
const openGeneralSettingsButton = $("#open-general-settings");
const backGeneralSettingsButton = $("#back-general-settings");
const privacySettingsView = $("#privacy-settings-view");
const openPrivacySettingsButton = $("#open-privacy-settings");
const backPrivacySettingsButton = $("#back-privacy-settings");
const chatsSettingsView = $("#chats-settings-view");
const openChatsSettingsButton = $("#open-chats-settings");
const backChatsSettingsButton = $("#back-chats-settings");
const chatMessageTextSizeSelect = $("#chat-message-text-size");
const chatEnterToSendInput = $("#chat-enter-to-send");
const chatConfirmDeleteInput = $("#chat-confirm-delete");
const chatShowMessageTimeInput = $("#chat-show-message-time");
const chatCompactLayoutInput = $("#chat-compact-layout");
function applyChatMessageTextSize(value) {
  const size = ["normal", "large", "xlarge"].includes(value) ? value : "normal";
  document.documentElement.dataset.chatMessageTextSize = size;
  localStorage.setItem("mersal-chat-message-text-size", size);
}
function applyChatMessageTimeVisibility(value) {
  const visible = value !== false;
  document.documentElement.dataset.chatShowMessageTime = String(visible);
  localStorage.setItem("mersal-chat-show-message-time", String(visible));
}
function applyChatCompactLayout(value) {
  const compact = value === true;
  document.documentElement.dataset.chatDensity = compact ? "compact" : "comfortable";
  localStorage.setItem("mersal-chat-compact-layout", String(compact));
}
function loadChatSettings() {
  chatMessageTextSizeSelect.value = localStorage.getItem("mersal-chat-message-text-size") || "normal";
  chatEnterToSendInput.checked = localStorage.getItem("mersal-chat-enter-to-send") === "true";
  chatConfirmDeleteInput.checked = localStorage.getItem("mersal-chat-confirm-delete") !== "false";
  chatShowMessageTimeInput.checked = localStorage.getItem("mersal-chat-show-message-time") !== "false";
  chatCompactLayoutInput.checked = localStorage.getItem("mersal-chat-compact-layout") === "true";
  applyChatMessageTextSize(chatMessageTextSizeSelect.value);
  applyChatMessageTimeVisibility(chatShowMessageTimeInput.checked);
  applyChatCompactLayout(chatCompactLayoutInput.checked);
}
loadChatSettings();
const privacyLastSeenSelect = $("#privacy-last-seen");
const privacyOnlineSelect = $("#privacy-online");
const privacyReadReceiptsInput = $("#privacy-read-receipts");
const privacyGroupAddSelect = $("#privacy-group-add");
const privacyHidePreviewInput = $("#privacy-hide-preview");
const privacyStatusSelect = $("#privacy-status");
const privacyProfilePhotoSelect = $("#privacy-profile-photo");
const privacyAboutSelect = $("#privacy-about");
const profilePhotoExclusionsArea = $("#profile-photo-exclusions-area");
const profilePhotoExclusionsList = $("#profile-photo-exclusions-list");
const saveProfilePhotoExclusionsButton = $("#save-profile-photo-exclusions");
const aboutExclusionsArea = $("#about-exclusions-area");
const aboutExclusionsList = $("#about-exclusions-list");
const privacyContactPicker = $("#privacy-contact-picker");
const privacyContactPickerList = $("#privacy-contact-picker-list");
const privacyContactPickerTitle = $("#privacy-contact-picker-title");
const savePrivacyContactPickerButton = $("#save-privacy-contact-picker");
const closePrivacyContactPickerButton = $("#close-privacy-contact-picker");
let activePrivacyPicker = null;
const privacySaveInProgress = new Set();
const saveAboutExclusionsButton = $("#save-about-exclusions");
const settingsAboutInput = $("#settings-about");
let profileSavedSnapshot = null;
let profileSaveInProgress = false;
function getProfileFormSnapshot() {
  return JSON.stringify({ name: displayNameInput.value.trim(), about: settingsAboutInput.value.trim() });
}
function updateProfileSaveButton() {
  const button = $("#save-settings");
  if (button) button.disabled = profileSaveInProgress || profileSavedSnapshot === null || getProfileFormSnapshot() === profileSavedSnapshot;
}
displayNameInput.addEventListener("input", updateProfileSaveButton);
settingsAboutInput.addEventListener("input", updateProfileSaveButton);
updateProfileSaveButton();
const conversationInfoAbout = $("#conversation-info-about");
const conversationInfoPhoto = $("#conversation-info-photo");
const conversationInfoPhotoRow = $("#conversation-info-photo-row");
const conversationInfoAboutRow = $("#conversation-info-about")?.parentElement;
const lastSeenExclusionsArea = $("#last-seen-exclusions-area");
const lastSeenExclusionsList = $("#last-seen-exclusions-list");
const saveLastSeenExclusionsButton = $("#save-last-seen-exclusions");
const groupAddExclusionsArea = $("#group-add-exclusions-area");
const groupAddExclusionsList = $("#group-add-exclusions-list");
const saveGroupAddExclusionsButton = $("#save-group-add-exclusions");
const statusExclusionsArea = $("#status-exclusions-area");
const statusExclusionsList = $("#status-exclusions-list");
const statusAudienceHelp = $("#status-audience-help");
const saveStatusExclusionsButton = $("#save-status-exclusions");
const blockedUsersList = $("#blocked-users-list");
let privacySettings = { last_seen_visibility:"contacts", online_visibility:"everyone", read_receipts_enabled:true, group_add_visibility:"everyone", status_visibility:"contacts", hide_notification_preview:false, profile_photo_visibility:"everyone", about_visibility:"everyone" };
let privacySettingsLoaded = false;
let selectedStatusExclusions = new Set();
let storedStatusExclusions = new Set();
let selectedLastSeenExclusions = new Set();
let storedLastSeenExclusions = new Set();
let selectedGroupAddExclusions = new Set();
let storedGroupAddExclusions = new Set();
let selectedProfilePhotoExclusions = new Set();
let storedProfilePhotoExclusions = new Set();
let selectedAboutExclusions = new Set();
let storedAboutExclusions = new Set();
let presenceDetails = new Map();
let presenceRefreshTimer = null;
const accountSettingsView = $("#account-settings-view");
const accountLogoutButton = $("#account-logout-button");
const deleteAccountButton = $("#delete-account-button");
const deleteAccountPanel = $("#delete-account-panel");
const closeDeleteAccountButton = $("#close-delete-account");
const cancelDeleteAccountButton = $("#cancel-delete-account");
const deleteAccountConfirmation = $("#delete-account-confirmation");
const confirmDeleteAccountButton = $("#confirm-delete-account");
const pushNotificationsButton = $("#enable-push-notifications");
const pushNotificationsHelp = $("#push-notifications-help");
let settingsReturnFocus = null;
const newChatButton=$("#new-chat-button"),newChatPanel=$("#new-chat-panel"),closeNewChatButton=$("#close-new-chat");
const privateChatView=$("#private-chat-view"),groupChatView=$("#group-chat-view"),groupNameInput=$("#group-name");
const groupPeopleSearch=$("#group-people-search"),groupPeopleList=$("#group-people-list"),createGroupButton=$("#create-group-button");
const newPrivateChatButton=$("#new-private-chat"),newGroupChatButton=$("#new-group-chat");
let selectedGroupMembers=new Set(),newChatReturnFocus=null;
const peopleSearch = $("#people-search");
const peopleList = $("#people-list");
const conversationList = $("#conversation-list");
const notificationsToggle = $("#notifications-toggle");
const notificationsPanel = $("#notifications-panel");
const closeNotificationsButton = $("#close-notifications");
const notificationsList = $("#notifications-list");
const notificationCount = $("#notification-count");

function setActiveBottomTab(tab) {
  if (!homeTabButton || !settingsTabButton || !statusTabButton) return;
  homeTabButton.setAttribute("aria-selected", String(tab === "home"));
  statusTabButton.setAttribute("aria-selected", String(tab === "statuses"));
  settingsTabButton.setAttribute("aria-selected", String(tab === "settings"));
}
function returnToHomeTab() {
  if (settingsPanel && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
  if (helpSupportPanel) helpSupportPanel.hidden = true;
  document.body.classList.remove("help-support-open");
  if (supportRealtimeChannel) supabase.removeChannel(supportRealtimeChannel);
  supportRealtimeChannel = null;
    document.body.classList.remove("settings-open");
  }
  statusView.hidden = true;
  document.body.classList.remove("status-open");
  setActiveBottomTab("home");
  if (document.body.classList.contains("chat-fullscreen")) backToChatsButton.click();
}
function openStatusTab() {
  if (!currentUser) return;
  if (settingsPanel && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    document.body.classList.remove("settings-open");
  }
  if (document.body.classList.contains("chat-fullscreen")) backToChatsButton.click();
  statusView.hidden = false;
  document.body.classList.add("status-open");
  setActiveBottomTab("statuses");
  void loadStatuses().catch(error => announce("تعذر تحميل الحالات: " + error.message, "error"));
}

const markAllReadButton = $("#mark-all-read");
const chatEmpty = $("#chat-empty");
const chatView = $("#chat-view");
const backToChatsButton = $("#back-to-chats");
const conversationInfoPanel = $("#conversation-info");
const closeConversationInfoButton = $("#close-conversation-info");
const conversationInfoName = $("#conversation-info-name");
const chatPartnerName = $("#chat-partner-name");
const chatPartnerAccessible = $("#chat-partner-accessible");
const chatPartnerPresence = $("#chat-partner-presence");
let activePartnerLastSeenAt = null;
let activeGroupMemberCount = null;
let lastSeenHeartbeat = null;
const conversationInfoStatus = $("#conversation-info-status");
const conversationInfoCreated = $("#conversation-info-created");
const conversationInfoCount = $("#conversation-info-count");
const conversationInfoNameLabel = $("#conversation-info-name-label");
const conversationInfoStatusRow = $("#conversation-info-status-row");
const conversationInfoExportButton = $("#conversation-info-export");
const conversationInfoMuteButton = $("#conversation-info-mute");
const conversationInfoClearButton = $("#conversation-info-clear");
const blockPersonButton = $("#block-person-button");
const conversationDeleteButton = $("#conversation-delete-button");
const groupAddMembersButton = $("#group-add-members-button");
const groupAddPanel = $("#group-add-panel");
const closeGroupAddButton = $("#close-group-add");
const groupAdminTools = $("#group-admin-tools");
const groupRenameInput = $("#group-rename-input");
const groupRenameSaveButton = $("#group-rename-save");
const groupAddSearch = $("#group-add-search");
const groupAddPeople = $("#group-add-people");
const groupAddSelectedButton = $("#group-add-selected");
const groupMemberList = $("#group-member-list");
const groupMemberOptionsPanel = $("#group-member-options-panel");
const closeGroupMemberOptionsButton = $("#close-group-member-options");
const groupMemberOptionsName = $("#group-member-options-name");
const groupMemberOptionsRole = $("#group-member-options-role");
const groupMemberOptionsActions = $("#group-member-options-actions");
let groupMemberOptionsReturnFocus = null;
const groupLeaveButton = $("#group-leave");
const groupDeleteEveryoneButton = $("#group-delete-everyone");
const voiceCallButton = $("#voice-call-button");
const voiceCallPanel = $("#voice-call-panel");
const voiceCallStatus = $("#voice-call-status");
const voiceCallParticipants = $("#voice-call-participants");
const voiceCallAudio = $("#voice-call-audio");
const voiceCallAcceptButton = $("#voice-call-accept");
const voiceCallRejectButton = $("#voice-call-reject");
const voiceCallMuteButton = $("#voice-call-mute");
const voiceCallEndButton = $("#voice-call-end");
const voiceCallEnableAudioButton = $("#voice-call-enable-audio");
const callChannels = new Map();
let activeCall = null;
let activeGroupMemberIds = new Set();
let selectedAdditionalMembers = new Set();
const conversationSearchArea = $("#conversation-search-area");
const conversationSearchInput = $("#conversation-search-input");
const conversationSearchStatus = $("#conversation-search-status");
const conversationSearchResults = $("#conversation-search-results");
const messagesList = $("#messages");
const messageForm = $("#message-form");
const messageInput = $("#message-input");
const sendButton = $("#send-button");
const attachButton = $("#attach-button");
const scheduledMessagesButton = $("#scheduled-messages-button");
const scheduledMessagesPanel = $("#scheduled-messages-panel");
const closeScheduledMessagesButton = $("#close-scheduled-messages");
const scheduledMessagesList = $("#scheduled-messages-list");
const messageSchedulePanel = $("#message-schedule-panel");
const closeMessageScheduleButton = $("#close-message-schedule");
const messageScheduleTimeInput = $("#message-schedule-time");
const messageSchedulePreview = $("#message-schedule-preview");
const confirmMessageScheduleButton = $("#confirm-message-schedule");
const messageScheduleHelp = $("#message-schedule-help");
const attachmentChooser = $("#attachment-chooser");
const closeAttachmentChooserButton = $("#close-attachment-chooser");
const imageFileInput = $("#image-file-input");
const videoFileInput = $("#video-file-input");
const documentFileInput = $("#document-file-input");
const attachmentViewer = document.createElement("section");
attachmentViewer.className = "attachment-viewer";
attachmentViewer.hidden = true;
attachmentViewer.setAttribute("role", "dialog");
attachmentViewer.setAttribute("aria-modal", "true");
attachmentViewer.setAttribute("aria-label", "عرض المرفق داخل المحادثة");
const attachmentViewerClose = safeText("button", "quiet-button attachment-viewer-close", "إغلاق العرض");
attachmentViewerClose.type = "button";
const attachmentViewerContent = document.createElement("div");
attachmentViewerContent.className = "attachment-viewer-content";
attachmentViewer.append(attachmentViewerClose, attachmentViewerContent);
document.body.append(attachmentViewer);
let attachmentViewerReturnFocus = null;
function closeAttachmentViewer() {
  attachmentViewer.hidden = true;
  attachmentViewerContent.replaceChildren();
  if (attachmentViewerReturnFocus?.isConnected) attachmentViewerReturnFocus.focus();
}

function createInlineVideoPlayer(media, label) {
  const player = document.createElement("div");
  player.className = "inline-video-player";
  media.controls = false;
  media.playsInline = true;
  media.preload = "metadata";
  media.disablePictureInPicture = true;
  media.disableRemotePlayback = true;
  media.setAttribute("playsinline", "");
  media.setAttribute("webkit-playsinline", "");
  media.setAttribute("controlslist", "nodownload noremoteplayback nofullscreen");
  media.setAttribute("aria-label", label);
  media.classList.add("inline-video-media");

  const controls = document.createElement("div");
  controls.className = "inline-video-controls";
  const rewind = safeText("button", "inline-video-action", "ترجيع 10 ثوانٍ");
  rewind.type = "button";
  rewind.setAttribute("aria-label", "ترجيع 10 ثوانٍ في " + label);
  const play = safeText("button", "inline-video-action", "تشغيل");
  play.type = "button";
  play.setAttribute("aria-label", "تشغيل " + label);
  const forward = safeText("button", "inline-video-action", "تقديم 10 ثوانٍ");
  forward.type = "button";
  forward.setAttribute("aria-label", "تقديم 10 ثوانٍ في " + label);
  const seek = document.createElement("input");
  seek.type = "range";
  seek.min = "0";
  seek.max = "0";
  seek.step = "0.1";
  seek.value = "0";
  seek.className = "inline-video-seek";
  seek.setAttribute("aria-label", "موضع التشغيل في " + label);
  const time = safeText("span", "inline-video-time", "0:00 / 0:00");
  time.setAttribute("aria-live", "off");

  const formatTime = value => {
    if (!Number.isFinite(value) || value < 0) value = 0;
    const seconds = Math.floor(value);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  };
  const update = () => {
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    seek.max = String(duration);
    seek.value = String(Math.min(media.currentTime || 0, duration));
    time.textContent = formatTime(media.currentTime) + " / " + formatTime(duration);
    const playing = !media.paused && !media.ended;
    play.textContent = playing ? "إيقاف مؤقت" : "تشغيل";
    play.setAttribute("aria-label", (playing ? "إيقاف " : "تشغيل ") + label);
  };
  rewind.addEventListener("click", () => {
    media.currentTime = Math.max(0, (media.currentTime || 0) - 10);
    update();
  });
  forward.addEventListener("click", () => {
    const duration = Number.isFinite(media.duration) ? media.duration : Infinity;
    media.currentTime = Math.min(duration, (media.currentTime || 0) + 10);
    update();
  });
  play.addEventListener("click", async () => {
    if (media.paused || media.ended) {
      try { await media.play(); } catch { play.textContent = "تعذر التشغيل"; }
    } else {
      media.pause();
    }
    update();
  });
  seek.addEventListener("input", () => {
    media.currentTime = Number(seek.value) || 0;
    update();
  });
  media.addEventListener("loadedmetadata", update);
  media.addEventListener("durationchange", update);
  media.addEventListener("timeupdate", update);
  media.addEventListener("play", update);
  media.addEventListener("pause", update);
  media.addEventListener("ended", update);
  controls.append(rewind, play, forward, seek, time);
  player.append(media, controls);
  update();
  return player;
}

function openAttachmentViewer(url, type, name, trigger) {
  attachmentViewerReturnFocus = trigger;
  attachmentViewerContent.replaceChildren();
  const title = safeText("p", "attachment-viewer-title", name || "مرفق");
  attachmentViewerContent.append(title);
  const mime = String(type || "").toLowerCase().split(";")[0].trim();
  if (mime.startsWith("image/")) {
    const media = document.createElement("img");
    media.src = url; media.alt = name || "صورة مرفقة"; media.className = "attachment-viewer-image";
    attachmentViewerContent.append(media);
  } else if (mime.startsWith("video/")) {
    const media = document.createElement("video");
    media.src = url;
    media.className = "attachment-viewer-video";
    attachmentViewerContent.append(createInlineVideoPlayer(media, "الفيديو المرفق داخل المحادثة"));
  } else if (mime.startsWith("audio/")) {
    const media = document.createElement("audio");
    media.src = url; media.controls = true; media.preload = "metadata";
    media.setAttribute("aria-label", "تشغيل الملف الصوتي داخل مرسال");
    media.className = "attachment-viewer-audio";
    attachmentViewerContent.append(media);
  } else if (mime === "application/pdf" || mime.startsWith("text/")) {
    const frame = document.createElement("iframe");
    frame.src = url;
    frame.title = "معاينة الملف داخل مرسال: " + (name || "ملف مرفق");
    frame.className = "attachment-viewer-frame";
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.setAttribute("referrerpolicy", "no-referrer");
    attachmentViewerContent.append(frame);
  } else {
    attachmentViewerContent.append(safeText("p", "attachment-viewer-message",
      "هذا النوع من الملفات لا يدعم المعاينة داخل مرسال حاليًا. لم يتم فتحه في تطبيق أو موقع خارجي."));
  }
  attachmentViewer.hidden = false;
  attachmentViewerClose.focus();
}
attachmentViewerClose.addEventListener("click", closeAttachmentViewer);
attachmentViewer.addEventListener("keydown", event => { if (event.key === "Escape") closeAttachmentViewer(); });
attachmentViewer.addEventListener("click", event => { if (event.target === attachmentViewer) closeAttachmentViewer(); });

const replyingTo = $("#replying-to");
const replyingToText = $("#replying-to-text");
const cancelReplyButton = $("#cancel-reply");
let replyingToMessage = null;
let currentUser = null;
let activeConversation = null;
let activePartner = null;
let activeConversationMuted = false;
let activeBlockState = { blockedByMe: false, blockedByThem: false };
let people = [];
let conversations = [];
let realtimeChannel = null;
let presenceChannel = null;
let onlineUserIds = new Set();
let notifications = [];
let notificationChannel = null;

let statusMessageTimer = null;
function announce(message, kind = "info") {
  if (statusMessageTimer) clearTimeout(statusMessageTimer);
  status.textContent = message;
  status.dataset.kind = kind;
  if (kind !== "error" && message) {
    const announcedMessage = message;
    statusMessageTimer = setTimeout(() => {
      if (status.textContent === announcedMessage && status.dataset.kind === kind) {
        status.textContent = "";
        status.dataset.kind = "";
      }
      statusMessageTimer = null;
    }, 2000);
  }
}
function getCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashQuery = rawHash.includes("?") ? rawHash.slice(rawHash.indexOf("?") + 1) : rawHash;
  for (const [key, value] of new URLSearchParams(hashQuery)) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}
function displayName(profile) {
  return profile?.display_name?.trim() || "مستخدم مرسال";
}
async function resolveProfileAvatar(profile) {
  if (!profile?.avatar_url) return profile;
  if (/^https?:\/\//i.test(profile.avatar_url)) return profile;
  const { data, error } = await supabase.storage.from("mersal-profile-photos").createSignedUrl(profile.avatar_url, 3600);
  if (error || !data?.signedUrl) {
    console.warn("تعذر تجهيز الصورة الشخصية:", error?.message || "رابط الصورة غير متاح");
    return { ...profile, avatar_url: null };
  }
  return { ...profile, avatar_url: data.signedUrl };
}
async function resolveProfileAvatars(profiles) {
  return Promise.all((profiles || []).map(resolveProfileAvatar));
}
function setProfilePhotoPreview(url) {
  profilePhotoPlaceholder.hidden = true;
  if (url) {
    profilePhotoPreview.src = url;
    profilePhotoPreview.hidden = false;
    removeProfilePhotoButton.hidden = false;
  } else {
    profilePhotoPreview.removeAttribute("src");
    profilePhotoPreview.hidden = true;
    removeProfilePhotoButton.hidden = !currentProfilePhotoPath && !currentProfilePhotoExternal;
  }
}
function appendProfileAvatar(container, profile) {
  let imageUrl=null;
  try {
    const candidate=new URL(profile?.avatar_url || "");
    if(candidate.protocol==="https:" || candidate.protocol==="http:") imageUrl=candidate.href;
  } catch {}
  if(!imageUrl) return null;
  const avatar=document.createElement("span");
  avatar.className="profile-avatar";
  avatar.setAttribute("aria-hidden","true");
  const image=document.createElement("img");
  image.src=imageUrl; image.alt=""; image.loading="lazy"; image.referrerPolicy="no-referrer";
  avatar.append(image);
  container.append(avatar);
  return avatar;
}
function formatSupportDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" });
}
function setSupportView(view) {
  for (const [name, element] of Object.entries({
    home: supportHomeView, form: supportFormView, requests: supportRequestsView,
    admin: supportAdminView, thread: supportThreadView
  })) element.hidden = name !== view;
}
function openHelpSupport() {
  if (!currentUser) return;
  supportReturnFocus = document.activeElement;
  settingsPanel.hidden = true;
  document.body.classList.remove("settings-open");
  helpSupportPanel.hidden = false;
  document.body.classList.add("help-support-open");
  setSupportView("home");
  closeHelpSupportButton.focus();
  startSupportRealtime();
  if (isMersalDeveloper()) void refreshSupportAdminBadge();
}
function closeHelpSupport() {
  helpSupportPanel.hidden = true;
  document.body.classList.remove("help-support-open");
  if (supportRealtimeChannel) supabase.removeChannel(supportRealtimeChannel);
  supportRealtimeChannel = null;
  settingsPanel.hidden = false;
  document.body.classList.add("settings-open");
  (supportReturnFocus || openHelpSupportButton).focus();
}
async function refreshSupportAdminBadge() {
  if (!isMersalDeveloper() || !supportAdminButton) return;
  const { count, error } = await supabase.from("support_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["new", "in_progress"]);
  if (error) { console.warn("تعذر تحديث عداد الدعم:", error.message); return; }
  supportAdminButton.textContent = "صندوق الدعم للمطور (" + (count || 0) + ")";
}
function startSupportRealtime() {
  if (!currentUser) return;
  if (supportRealtimeChannel) return;
  const requestConfig = { event: "*", schema: "public", table: "support_requests" };
  if (!isMersalDeveloper()) requestConfig.filter = "user_id=eq." + currentUser.id;
  supportRealtimeChannel = supabase.channel("mersal-support-" + currentUser.id)
    .on("postgres_changes", requestConfig, payload => {
      if (isMersalDeveloper()) {
        void refreshSupportAdminBadge();
        if (payload.eventType === "INSERT" && payload.new?.user_id !== currentUser.id) {
          announce("وصل طلب دعم جديد إلى صندوق المطور.");
        }
      }
      if (!helpSupportPanel.hidden) {
        if (!supportAdminView.hidden) void loadSupportRequests(true);
        else if (!supportRequestsView.hidden) void loadSupportRequests(false);
        else if (activeSupportRequest) void loadSupportMessages(activeSupportRequest.id);
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "support_request_messages" }, payload => {
      if (activeSupportRequest && payload.new?.request_id === activeSupportRequest.id) {
        void loadSupportMessages(activeSupportRequest.id);
      }
    }).subscribe();
}
function renderSupportRequests(target, rows, profiles = new Map()) {
  target.replaceChildren();
  if (!rows.length) {
    target.append(safeText("li", "empty-item", isMersalDeveloper() && target.id === "support-admin-list" ? "لا توجد طلبات تطابق التصفية." : "لا توجد طلبات حتى الآن."));
    return;
  }
  for (const request of rows) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "support-request-card";
    const title = safeText("strong", "support-request-subject", request.subject);
    const meta = safeText("span", "support-request-meta",
      "رقم الطلب " + request.ticket_code + " · " + (supportCategoryLabels[request.category] || "أخرى"));
    const status = safeText("span", "support-request-status status-" + request.status,
      "الحالة: " + (supportStatusLabels[request.status] || request.status));
    const date = safeText("span", "support-request-date", formatSupportDate(request.created_at));
    button.append(title, meta);
    if (isMersalDeveloper() && profiles.has(request.user_id)) {
      button.append(safeText("span", "support-request-meta", "صاحب الطلب: " + profiles.get(request.user_id)));
    }
    button.append(status, date);
    button.setAttribute("aria-label", request.subject + "، رقم الطلب " + request.ticket_code + "، الحالة " + (supportStatusLabels[request.status] || request.status));
    button.addEventListener("click", () => void openSupportRequest(request.id, target.id === "support-admin-list" ? "admin" : "requests"));
    item.append(button);
    target.append(item);
  }
}
async function loadSupportRequests(admin = false) {
  const target = admin ? $("#support-admin-list") : $("#support-requests-list");
  target.replaceChildren(safeText("li", "empty-item", "جارٍ تحميل الطلبات…"));
  let query = supabase.from("support_requests").select("*").order("created_at", { ascending: false }).limit(100);
  if (!admin) query = query.eq("user_id", currentUser.id);
  else if (supportAdminFilter.value !== "all") query = query.eq("status", supportAdminFilter.value);
  const { data, error } = await query;
  if (error) { announce("تعذر تحميل طلبات الدعم: " + error.message, "error"); return; }
  const rows = data || [];
  const profiles = new Map();
  if (admin && rows.length) {
    const ids = [...new Set(rows.map(row => row.user_id))];
    const result = await supabase.from("profiles").select("id,display_name").in("id", ids);
    if (!result.error) for (const profile of result.data || []) profiles.set(profile.id, profile.display_name || "مستخدم مرسال");
  }
  renderSupportRequests(target, rows, profiles);
}
async function loadSupportMessages(requestId) {
  const list = $("#support-messages-list");
  list.replaceChildren(safeText("li", "empty-item", "جارٍ تحميل المراسلات…"));
  const { data, error } = await supabase.from("support_request_messages")
    .select("id,request_id,author_id,body,created_at")
    .eq("request_id", requestId).order("created_at", { ascending: true }).limit(200);
  if (error) { announce("تعذر تحميل تفاصيل الطلب: " + error.message, "error"); return; }
  list.replaceChildren();
  if (!data?.length) list.append(safeText("li", "empty-item", "لا توجد مراسلات بعد."));
  for (const message of data || []) {
    const item = document.createElement("li");
    item.className = "support-message " + (message.author_id === currentUser.id ? "is-own" : "is-other");
    const author = message.author_id === currentUser.id ? "أنت" :
      (isMersalDeveloper() ? "صاحب الطلب" : "المطور");
    item.append(safeText("strong", "support-message-author", author));
    item.append(safeText("p", "support-message-body", message.body));
    item.append(safeText("time", "support-message-time", formatSupportDate(message.created_at)));
    list.append(item);
  }
}
async function renderSupportAttachment(request) {
  const host = $("#support-request-attachment");
  host.replaceChildren();
  host.hidden = true;
  if (!request?.attachment_path) return;
  const { data, error } = await supabase.storage.from("mersal-support-attachments")
    .createSignedUrl(request.attachment_path, 900);
  if (error || !data?.signedUrl) {
    host.append(safeText("p", "support-attachment-name", "تعذر تحميل المرفق داخل مرسال."));
    host.hidden = false;
    return;
  }
  host.append(safeText("p", "support-attachment-name", "المرفق: " + (request.attachment_name || "ملف مرفق")));
  const mime = request.attachment_type || "";
  if (mime.startsWith("image/")) {
    const image = document.createElement("img");
    image.className = "support-attachment-image";
    image.src = data.signedUrl;
    image.alt = "المرفق المرفوع: " + (request.attachment_name || "صورة");
    host.append(image);
  } else if (mime === "video/mp4") {
    const video = document.createElement("video");
    video.className = "support-attachment-video";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = data.signedUrl;
    video.setAttribute("aria-label", "الفيديو المرفق: " + (request.attachment_name || "فيديو"));
    host.append(video);
  } else if (mime === "application/pdf") {
    const frame = document.createElement("iframe");
    frame.className = "support-attachment-pdf";
    frame.src = data.signedUrl;
    frame.title = "معاينة ملف PDF داخل مرسال: " + (request.attachment_name || "ملف PDF");
    host.append(frame);
  }
  host.hidden = false;
}
async function openSupportRequest(requestId, origin = "requests") {
  const { data, error } = await supabase.from("support_requests").select("*").eq("id", requestId).maybeSingle();
  if (error || !data) { announce("لا يمكن فتح هذا الطلب.", "error"); return; }
  activeSupportRequest = data;
  supportThreadOrigin = origin;
  $("#support-thread-title").textContent = data.subject || "تفاصيل الطلب";
  $("#support-ticket-code").textContent = "رقم الطلب: " + data.ticket_code;
  $("#support-ticket-category").textContent = "نوع الطلب: " + (supportCategoryLabels[data.category] || "أخرى");
  $("#support-ticket-status").textContent = "الحالة: " + (supportStatusLabels[data.status] || data.status);
  $("#support-request-description").textContent = data.description;
  await renderSupportAttachment(data);
  supportAdminStatusTools.hidden = !isMersalDeveloper();
  $("#support-reply-form").hidden = data.status === "closed" && !isMersalDeveloper();
  supportStatusSelect.value = data.status;
  setSupportView("thread");
  await loadSupportMessages(data.id);
  $("#support-reply-input").focus();
}
openHelpSupportButton.addEventListener("click", openHelpSupport);
closeHelpSupportButton.addEventListener("click", closeHelpSupport);
helpSupportPanel.addEventListener("keydown", event => {
  if (event.key === "Escape") closeHelpSupport();
});
$("#support-new-request").addEventListener("click", () => {
  supportRequestForm.reset();
  setSupportView("form");
  $("#support-subject").focus();
});
$("#support-my-requests").addEventListener("click", async () => {
  setSupportView("requests");
  await loadSupportRequests(false);
  $("#support-requests-back").focus();
});
supportAdminButton.addEventListener("click", async () => {
  if (!isMersalDeveloper()) return;
  setSupportView("admin");
  await loadSupportRequests(true);
  $("#support-admin-filter").focus();
});
for (const id of ["support-form-back", "support-requests-back", "support-admin-back"]) {
  $("#" + id).addEventListener("click", () => { setSupportView("home"); $("#support-new-request").focus(); });
}
$("#support-admin-refresh").addEventListener("click", () => void loadSupportRequests(true));
supportAdminFilter.addEventListener("change", () => void loadSupportRequests(true));
supportRequestForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;
  const button = $("#support-submit-request");
  button.disabled = true;
  const file = supportAttachmentInput.files?.[0] || null;
  const requestId = crypto.randomUUID();
  let uploadedPath = null;
  let requestCreated = false;
  const payload = {
    id: requestId,
    user_id: currentUser.id,
    category: $("#support-category").value,
    subject: $("#support-subject").value.trim(),
    description: $("#support-description").value.trim()
  };
  try {
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"];
      if (!allowedTypes.includes(file.type)) throw new Error("نوع الملف غير مدعوم.");
      if (file.size > 20 * 1024 * 1024) throw new Error("حجم المرفق يتجاوز 20 ميغابايت.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "attachment";
      uploadedPath = currentUser.id + "/" + requestId + "/" + Date.now() + "-" + safeName;
      const upload = await supabase.storage.from("mersal-support-attachments").upload(uploadedPath, file, {
        cacheControl: "3600", upsert: false, contentType: file.type
      });
      if (upload.error) throw upload.error;
      payload.attachment_path = uploadedPath;
      payload.attachment_name = file.name;
      payload.attachment_type = file.type;
    }
    const { data, error } = await supabase.from("support_requests").insert(payload).select("*").single();
    if (error) throw error;
    requestCreated = true;
    supportRequestForm.reset();
    announce("تم إرسال طلبك بنجاح.");
    await openSupportRequest(data.id, "created");
    if (isMersalDeveloper()) void refreshSupportAdminBadge();
  } catch (error) {
    if (uploadedPath && !requestCreated) {
      await supabase.storage.from("mersal-support-attachments").remove([uploadedPath]).catch(() => {});
    }
    announce("تعذر إرسال الطلب: " + (error.message || "حاول مرة أخرى."), "error");
  } finally { button.disabled = false; }
});
supportReplyForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!activeSupportRequest || !currentUser) return;
  const input = $("#support-reply-input");
  const button = $("#support-send-reply");
  const body = input.value.trim();
  if (!body) return;
  button.disabled = true;
  try {
    const { error } = await supabase.from("support_request_messages").insert({
      request_id: activeSupportRequest.id, author_id: currentUser.id, body
    });
    if (error) throw error;
    input.value = "";
    await loadSupportMessages(activeSupportRequest.id);
    announce("تم إرسال الرد.");
  } catch (error) {
    announce("تعذر إرسال الرد: " + (error.message || "حاول مرة أخرى."), "error");
  } finally { button.disabled = false; }
});
$("#support-save-status").addEventListener("click", async () => {
  if (!isMersalDeveloper() || !activeSupportRequest) return;
  const button = $("#support-save-status");
  button.disabled = true;
  try {
    const { data, error } = await supabase.from("support_requests")
      .update({ status: supportStatusSelect.value, updated_at: new Date().toISOString() })
      .eq("id", activeSupportRequest.id).select("*").single();
    if (error) throw error;
    activeSupportRequest = data;
    $("#support-ticket-status").textContent = "الحالة: " + (supportStatusLabels[data.status] || data.status);
    $("#support-reply-form").hidden = data.status === "closed" && !isMersalDeveloper();
    announce("تم تحديث حالة الطلب.");
    void refreshSupportAdminBadge();
  } catch (error) { announce("تعذر تحديث الحالة: " + (error.message || "حاول مرة أخرى."), "error"); }
  finally { button.disabled = false; }
});
$("#support-thread-back").addEventListener("click", async () => {
  activeSupportRequest = null;
  if (supportThreadOrigin === "admin") {
    setSupportView("admin");
    await loadSupportRequests(true);
    $("#support-admin-filter").focus();
  } else {
    setSupportView("requests");
    await loadSupportRequests(false);
    $("#support-requests-back").focus();
  }
});

function safeText(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value ?? "";
  return node;
}
function showLoggedOut(message = "لم يتم تسجيل الدخول. يمكنك المحاولة مرة أخرى باستخدام Google.") {
  finishStartup();
  settingsPanel.hidden = true;
  document.body.classList.remove("settings-open");
  bottomNavigation.hidden = true;
  statusView.hidden = true;
  statusComposerPanel.hidden = true;
  statusViewerPanel.hidden = true;
  messageSchedulePanel.hidden = true;
  scheduledMessagesPanel.hidden = true;
  if (statusExpiryTimer) clearTimeout(statusExpiryTimer);
  statusExpiryTimer = null;
  document.body.classList.remove("status-open");
  document.body.classList.remove("chat-fullscreen");
  workspace.classList.remove("chat-open");
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  currentUser = null;
  activeConversation = null;
  activePartner = null;
  authPanel.hidden = false;
  workspace.hidden = true;
  account.textContent = "غير مسجل الدخول";
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  if (presenceChannel) supabase.removeChannel(presenceChannel);
  if (notificationChannel) supabase.removeChannel(notificationChannel);
  void endVoiceCall(false);
  void closeCallChannel();
  realtimeChannel = null;
  presenceChannel = null;
  notificationChannel = null;
  notifications = [];
  onlineUserIds = new Set();
  announce(message, "error");
}
async function ensureProfile(user) {
  const { data: existing, error: readError } = await supabase.from("profiles")
    .select("id").eq("id", user.id).maybeSingle();
  if (readError) throw readError;
  if (existing) return;
  const metadata = user.user_metadata || {};
  const name = metadata.full_name || metadata.name || user.email?.split("@")[0] || "مستخدم مرسال";
  const avatar = metadata.avatar_url || metadata.picture || null;
  const { error } = await supabase.from("profiles").insert({
    id: user.id, display_name: name, avatar_url: avatar, updated_at: new Date().toISOString()
  });
  if (error && error.code !== "23505") throw error;
}
async function handleSession(session, authEvent = "UNKNOWN") {
  if (!session?.user) {
    const callbackParams = getCallbackParams();
    if (callbackParams.has("code")) {
      showLoggedOut("رجعت من Google، لكن مرسال لم يستلم جلسة الدخول. هذا يعني أن إكمال تسجيل الدخول تعثّر بعد الرجوع من Google.");
    } else {
      showLoggedOut();
    }
    return;
  }
  const alreadyLoadedForThisUser = currentUser?.id === session.user.id && !workspace.hidden;
  if (currentUser?.id !== session.user.id) {
    privacySettings = { last_seen_visibility:"contacts", online_visibility:"everyone", read_receipts_enabled:true,
      group_add_visibility:"everyone", status_visibility:"contacts", hide_notification_preview:false,
      profile_photo_visibility:"everyone", about_visibility:"everyone" };
    privacySettingsLoaded = false;
    presenceDetails.clear();
    onlineUserIds.clear();
  }
  currentUser = session.user;
  supportAdminButton.hidden = !isMersalDeveloper();
  authPanel.hidden = true;
  workspace.hidden = false;
  bottomNavigation.hidden = false;
  setActiveBottomTab("home");
  account.textContent = "مرحبًا بك في مرسال · متصل الآن";

  // Reveal the usable app immediately; load account data and live updates in the background.
  finishStartup();
  if (status.textContent === "جارٍ تجهيز مرسال…") status.textContent = "";

  void syncPushNotificationState();
  void loadStatuses().catch(error => announce("تعذر تحميل الحالات: " + (error.message || "حاول مرة أخرى."), "error"));
  void touchLastSeen();
  if (!lastSeenHeartbeat) lastSeenHeartbeat = window.setInterval(() => { if (document.visibilityState === "visible") void touchLastSeen(); }, 60000);

  try {
    if (!alreadyLoadedForThisUser) {
      await ensureProfile(session.user);
      // Load privacy before notifications so a saved hidden-preview preference is applied before any preview is rendered.
      await loadPrivacySettings();
      await Promise.all([loadPeople(), loadConversations(), loadNotifications(), loadOwnProfile()]);
    }
    await startPresence();
    startNotificationsRealtime();
    if (isMersalDeveloper()) {
      void refreshSupportAdminBadge();
      startSupportRealtime();
    }
    if (!alreadyLoadedForThisUser && authEvent !== "TOKEN_REFRESHED") {
      announce("تم تسجيل الدخول. يمكنك بدء محادثة جديدة.");
    }
  } catch (error) {
    finishStartup();
    announce("تعذر تحميل بعض بيانات الحساب: " + (error.message || "خطأ غير معروف"), "error");
  }
}

async function touchLastSeen() {
  if (!currentUser || document.visibilityState !== "visible") return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("profiles").update({ last_seen_at: now }).eq("id", currentUser.id);
  if (error) console.warn("تعذر تحديث آخر ظهور:", error.message);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void touchLastSeen();
  else if(currentUser) void syncCallChannels();
});

function formatLastSeen(value) {
  if (!value) return "آخر ظهور غير متوفر";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString("ar-JO", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return "آخر ظهور اليوم الساعة " + time;
  if (sameYesterday) return "آخر ظهور أمس الساعة " + time;
  return "آخر ظهور " + date.toLocaleDateString("ar-JO", { day: "numeric", month: "long" }) + " الساعة " + time;
}
function updateChatPartnerPresence() {
  if ((!activePartner && !activeConversation?.is_group) || !chatPartnerPresence) return;
  if (activeConversation?.is_group) {
    chatPartnerPresence.textContent = "مجموعة";
    chatPartnerPresence.classList.remove("is-online", "is-offline");
    updateGroupHeaderAccessibleLabel();
    return;
  }
  const details = presenceDetails.get(activePartner.id);
  const reciprocalHidden=privacySettingsLoaded&&privacySettings.last_seen_visibility==="nobody";
  const online = reciprocalHidden ? false : Boolean(details?.is_online);
  const visibleLastSeen = reciprocalHidden ? null : details?.last_seen_at || null;
  chatPartnerPresence.textContent = online ? "متصل الآن" : visibleLastSeen ? formatLastSeen(visibleLastSeen) : "حالة الظهور مخفية";
  chatPartnerPresence.classList.toggle("is-online", online);
  chatPartnerPresence.classList.toggle("is-offline", !online);
  chatPartnerAccessible.setAttribute("aria-label", `${chatPartnerName.textContent}، ${chatPartnerPresence.textContent}`);
}

function updateGroupHeaderAccessibleLabel() {
  if (!activeConversation?.is_group || !chatPartnerAccessible) return;
  const name = chatPartnerName.textContent || activeConversation.group_name || "مجموعة";
  const countLabel = activeGroupMemberCount === null
    ? "جارٍ تحميل عدد الأعضاء"
    : "عدد الأعضاء " + new Intl.NumberFormat("ar-JO").format(activeGroupMemberCount);
  chatPartnerAccessible.setAttribute("aria-label", name + "، " + countLabel);
}
async function refreshGroupHeaderMemberCount(conversationId = activeConversation?.id) {
  if (!conversationId || !currentUser || !activeConversation?.is_group || activeConversation.id !== conversationId) return;
  const { count, error } = await supabase.from("conversation_members")
    .select("user_id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  if (error) {
    console.warn("تعذر تحميل عدد أعضاء المجموعة:", error.message);
    activeGroupMemberCount = null;
    updateGroupHeaderAccessibleLabel();
    return;
  }
  if (!activeConversation?.is_group || activeConversation.id !== conversationId) return;
  activeGroupMemberCount = count || 0;
  updateGroupHeaderAccessibleLabel();
}

async function refreshVisiblePresence() {
  if (!currentUser) return;
  if(privacySettingsLoaded&&privacySettings.last_seen_visibility==="nobody"){
    presenceDetails=new Map(); onlineUserIds=new Set(); activePartnerLastSeenAt=null;
    if(activePartner)updateChatPartnerPresence();
    if(activeConversation&&!activeConversation.is_group)setConversationInfoValue(conversationInfoStatus,"حالة الظهور مخفية");
    conversationList.querySelectorAll(".conversation-presence").forEach(node=>node.remove());
    renderPeople(); return;
  }
  const { data, error } = await supabase.rpc("get_visible_presence");
  if (error) throw error;
  presenceDetails = new Map((data || []).map(row => [row.user_id, row]));
  onlineUserIds = new Set((data || []).filter(row => row.is_online).map(row => row.user_id));
  if (activePartner) {
    activePartnerLastSeenAt = presenceDetails.get(activePartner.id)?.last_seen_at || null;
    updateChatPartnerPresence();
  }
  if (activeConversation && !activeConversation.is_group && activePartner) {
    const details = presenceDetails.get(activePartner.id);
    setConversationInfoValue(conversationInfoStatus, details?.is_online ? "متصل الآن" : details?.last_seen_at ? formatLastSeen(details.last_seen_at) : "حالة الظهور مخفية");
  }
  conversationList.querySelectorAll(".conversation-button[data-partner-id]").forEach(button => {
    const online = onlineUserIds.has(button.dataset.partnerId);
    const existing = button.querySelector(".conversation-presence");
    if (online && !existing) button.append(safeText("span", "conversation-presence is-online", "متصل الآن"));
    else if (!online && existing) existing.remove();
  });
}
async function startPresence() {
  if (!currentUser) return;
  if (presenceChannel) { await supabase.removeChannel(presenceChannel); presenceChannel = null; }
  if (presenceRefreshTimer) clearInterval(presenceRefreshTimer);
  await refreshVisiblePresence();
  renderPeople();
  presenceRefreshTimer = window.setInterval(() => {
    void refreshVisiblePresence().then(() => renderPeople())
      .catch(error => console.warn("تعذر تحديث الحضور:", error.message));
  }, 45000);
}

async function syncPushNotificationState() {
  if (!currentUser) return;
  if (!("Notification" in window) || !("PushManager" in window)) {
    pushNotificationsButton.textContent = "إشعارات الهاتف غير مدعومة";
    pushNotificationsButton.disabled = true;
    return;
  }
  try {
    const registration = await serviceWorkerReady;
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (Notification.permission === "granted" && subscription) {
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: currentUser.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON()
      }, { onConflict: "endpoint" });
      if (error) throw error;
      pushNotificationsButton.textContent = "إيقاف إشعارات الهاتف";
      pushNotificationsHelp.textContent = "إشعارات الهاتف مفعّلة على هذا الجهاز.";
      pushNotificationsButton.disabled = false;
      pushNotificationsButton.setAttribute("aria-pressed", "true");
      return;
    }
    pushNotificationsButton.textContent = "تشغيل إشعارات الهاتف";
    pushNotificationsButton.disabled = false;
    pushNotificationsButton.setAttribute("aria-pressed", "false");
    if (Notification.permission === "denied") {
      pushNotificationsHelp.textContent = "الإشعارات محظورة من إعدادات الجهاز. اسمح بها لمرسال من إعدادات الإشعارات.";
    } else if (Notification.permission === "granted") {
      pushNotificationsHelp.textContent = "الإشعارات متوقفة على هذا الجهاز. يمكنك تشغيلها من هنا.";
    } else {
      pushNotificationsHelp.textContent = "يمكنك تشغيل إشعارات الرسائل أو إيقافها من هذا الزر.";
    }
  } catch (error) {
    console.warn("Could not restore push notification state:", error);
    pushNotificationsButton.textContent = "تشغيل إشعارات الهاتف";
    pushNotificationsButton.disabled = false;
    pushNotificationsButton.setAttribute("aria-pressed", "false");
  }
}

function applicationServerKeyFromBase64(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

pushNotificationsButton.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!("Notification" in window) || !("PushManager" in window)) {
    pushNotificationsHelp.textContent = "هذا المتصفح لا يدعم إشعارات الهاتف.";
    return;
  }
  pushNotificationsButton.disabled = true;
  try {
    const registration = await serviceWorkerReady;
    if (!registration) throw new Error("تعذر تجهيز خدمة الإشعارات.");
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      const { error } = await supabase.from("push_subscriptions")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("endpoint", existingSubscription.endpoint);
      if (error) throw error;
      const unsubscribed = await existingSubscription.unsubscribe();
      if (!unsubscribed) throw new Error("لم يتم إيقاف اشتراك الإشعارات. حاول مرة أخرى.");
      pushNotificationsButton.textContent = "تشغيل إشعارات الهاتف";
      pushNotificationsButton.setAttribute("aria-pressed", "false");
      pushNotificationsHelp.textContent = "تم إيقاف إشعارات الهاتف على هذا الجهاز.";
      pushNotificationsButton.disabled = false;
      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (isIOS && !isInstalled) {
      pushNotificationsHelp.textContent = "أضف مرسال إلى الشاشة الرئيسية أولًا، ثم افتحه من الأيقونة وشغّل الإشعارات من هنا.";
      pushNotificationsButton.disabled = false;
      return;
    }
    if (Notification.permission === "denied") {
      pushNotificationsHelp.textContent = "الإشعارات محظورة من إعدادات الجهاز. اسمح بها لمرسال من إعدادات الإشعارات ثم أعد المحاولة.";
      pushNotificationsButton.disabled = false;
      return;
    }
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") {
      pushNotificationsHelp.textContent = "لم يتم السماح بالإشعارات. يمكنك تفعيلها من إعدادات الجهاز.";
      pushNotificationsButton.disabled = false;
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKeyFromBase64(VAPID_PUBLIC_KEY)
    });
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: currentUser.id,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON()
    }, { onConflict: "endpoint" });
    if (error) {
      await subscription.unsubscribe();
      throw error;
    }
    pushNotificationsButton.textContent = "إيقاف إشعارات الهاتف";
    pushNotificationsButton.setAttribute("aria-pressed", "true");
    pushNotificationsHelp.textContent = "تم تشغيل إشعارات الهاتف على هذا الجهاز.";
    pushNotificationsButton.disabled = false;
  } catch (error) {
    pushNotificationsHelp.textContent = "تعذر تغيير إعداد الإشعارات: " + (error.message || "حاول مرة أخرى.");
    pushNotificationsButton.disabled = false;
    await syncPushNotificationState();
  }
});

async function loadNotifications() {
  if (!currentUser) return;
  const { data, error } = await supabase.from("notifications")
    .select("id,recipient_id,sender_id,conversation_id,message_id,preview,created_at,read_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  notifications = data || [];
  const senderIds = [...new Set(notifications.map(item => item.sender_id))];
  let profileMap = new Map();
  if (senderIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles")
      .select("id,display_name").in("id", senderIds);
    if (profileError) throw profileError;
    profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
  }
  renderNotifications(profileMap);
}
function renderNotifications(profileMap = new Map()) {
  notificationsList.replaceChildren();
  const unread = notifications.filter(item => !item.read_at).length;
  notificationCount.hidden = unread === 0;
  notificationCount.textContent = String(unread);
  notificationsToggle.setAttribute("aria-label", unread ? "الإشعارات، " + unread + " غير مقروءة" : "الإشعارات");
  markAllReadButton.hidden = unread === 0;
  if (!notifications.length) {
    notificationsList.append(safeText("li", "empty-item", "لا توجد إشعارات بعد."));
    return;
  }
  for (const notification of notifications) {
    const sender = profileMap.get(notification.sender_id) || { display_name: "مستخدم مرسال" };
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notification-item" + (notification.read_at ? " is-read" : " is-unread");
    const safePreview = (!privacySettingsLoaded || privacySettings.hide_notification_preview) ? "رسالة جديدة" : (notification.preview || "أرسل رسالة جديدة");
    button.setAttribute("aria-label", (notification.read_at ? "مقروء: " : "غير مقروء: ") + displayName(sender) + ". " + safePreview);
    button.append(safeText("span", "notification-sender", displayName(sender)));
    button.append(safeText("span", "notification-preview", safePreview));
    button.append(safeText("time", "notification-time", new Date(notification.created_at).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "short" })));
    button.addEventListener("click", () => { void openNotification(notification, sender); });
    item.append(button);
    notificationsList.append(item);
  }
}
async function openNotification(notification, sender) {
  if (!currentUser) return;
  notificationsPanel.hidden = true;
  const { data: conversation, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,created_at,last_message_at,is_group,group_name")
    .eq("id", notification.conversation_id).single();
  if (error) {
    announce("تعذر فتح المحادثة من الإشعار: " + error.message, "error");
    return;
  }
  await selectConversation(conversation, sender);
  if (conversation.is_group) {
    chatPartnerName.textContent = conversation.group_name || "مجموعة";
    chatPartnerPresence.textContent = "مجموعة";
    chatPartnerAccessible.setAttribute("aria-label", chatPartnerName.textContent + "، مجموعة");
  }
}
function startNotificationsRealtime() {
  if (!currentUser) return;
  if (notificationChannel) void supabase.removeChannel(notificationChannel);
  notificationChannel = supabase.channel("notifications-" + currentUser.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "notifications",
      filter: "recipient_id=eq." + currentUser.id
    }, async (payload) => {
      try {
        await loadNotifications();
        const { data } = await supabase.from("profiles").select("display_name")
          .eq("id", payload.new.sender_id).maybeSingle();
        announce("إشعار جديد من " + (data?.display_name || "مستخدم مرسال"));
      } catch (error) {
        announce("وصلك إشعار جديد، لكن تعذر تحديث القائمة: " + error.message, "error");
      }
    })
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "messages"
    }, payload => {
      if (payload.new?.is_deleted) {
        void loadConversations().catch(error => console.warn("تعذر تحديث معاينة الرسالة المحذوفة:", error));
      }
    })
    .subscribe();
}
function closeNotifications() {
  if (notificationsPanel.hidden) return;
  notificationsPanel.hidden = true;
  notificationsToggle.focus();
}
notificationsToggle.addEventListener("click", async () => {
  const opening = notificationsPanel.hidden;
  notificationsPanel.hidden = !opening;
  if (opening) {
    closeNotificationsButton.focus();
    try { await loadNotifications(); }
    catch (error) { announce("تعذر تحميل الإشعارات: " + error.message, "error"); }
  }
});
closeNotificationsButton.addEventListener("click", closeNotifications);
notificationsPanel.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeNotifications();
  }
});
markAllReadButton.addEventListener("click", async () => {
  markAllReadButton.disabled = true;
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) announce("تعذر تحديث الإشعارات: " + error.message, "error");
  else {
    await loadNotifications();
    announce("تم التحديد.", "success");
  }
  markAllReadButton.disabled = false;
});
async function markConversationNotificationsRead(conversationId) {
  if (!currentUser) return;
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).is("read_at", null);
  if (error) throw error;
  await loadNotifications();
}

function applyTextSize(size) {
  document.documentElement.classList.remove("text-large", "text-xlarge");
  if (size === "large") document.documentElement.classList.add("text-large");
  if (size === "xlarge") document.documentElement.classList.add("text-xlarge");
}

function applyTheme(choice) {
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  const resolved = choice === "system" ? (prefersLight ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = choice;
}


async function loadPrivacySettings() {
  if (!currentUser) return;
  const { data, error } = await supabase.from("privacy_settings").select("*").eq("user_id", currentUser.id).maybeSingle();
  if (error) throw error;
  if (data) privacySettings = { ...privacySettings, ...data };
  if (privacySettings.status_visibility === "custom") privacySettings.status_visibility = "contacts_except";
  if (privacySettings.group_add_visibility === "nobody") privacySettings.group_add_visibility = "contacts_except";
  // WhatsApp has no separate "Nobody" status audience; an empty "Only share with" list means nobody.
  if (privacySettings.status_visibility === "nobody") privacySettings.status_visibility = "only_share";
  privacySettingsLoaded = true;
  privacyLastSeenSelect.value = privacySettings.last_seen_visibility;
  privacyOnlineSelect.value = ["same_as_last_seen","everyone"].includes(privacySettings.online_visibility) ? privacySettings.online_visibility : "same_as_last_seen";
  privacyReadReceiptsInput.checked = privacySettings.read_receipts_enabled;
  privacyGroupAddSelect.value = privacySettings.group_add_visibility;
  privacyHidePreviewInput.checked = privacySettings.hide_notification_preview;
  privacyStatusSelect.value = privacySettings.status_visibility;
  privacyProfilePhotoSelect.value = privacySettings.profile_photo_visibility || "everyone";
  privacyAboutSelect.value = privacySettings.about_visibility || "everyone";
  profilePhotoExclusionsArea.hidden = privacySettings.profile_photo_visibility !== "contacts_except";
  aboutExclusionsArea.hidden = privacySettings.about_visibility !== "contacts_except";
  lastSeenExclusionsArea.hidden = privacySettings.last_seen_visibility !== "contacts_except";
  groupAddExclusionsArea.hidden = privacySettings.group_add_visibility !== "contacts_except";
  statusExclusionsArea.hidden = !["contacts_except","only_share"].includes(privacySettings.status_visibility);
  statusAudienceHelp.textContent = privacySettings.status_visibility === "only_share"
    ? "حدد الأشخاص الذين سيتمكنون من مشاهدة حالاتك فقط."
    : "حدد الأشخاص الذين لن يتمكنوا من مشاهدة حالاتك.";
  await Promise.all([renderPrivacyExclusionChoices("last_seen",false), renderPrivacyExclusionChoices("group_add",false), renderPrivacyExclusionChoices("profile_photo",false), renderPrivacyExclusionChoices("about",false), renderStatusAudienceChoices(false), renderBlockedUsers()]);
  if (notifications.length) renderNotifications();
  updatePrivacySaveButtons();
}
async function savePrivacySettings() {
  if (!currentUser) return;
  const next = { user_id:currentUser.id, last_seen_visibility:privacyLastSeenSelect.value,
    online_visibility:privacyOnlineSelect.value, read_receipts_enabled:privacyReadReceiptsInput.checked,
    group_add_visibility:privacyGroupAddSelect.value, hide_notification_preview:privacyHidePreviewInput.checked,
    status_visibility:privacyStatusSelect.value, profile_photo_visibility:privacyProfilePhotoSelect.value,
    about_visibility:privacyAboutSelect.value, updated_at:new Date().toISOString() };
  const { error } = await supabase.from("privacy_settings").upsert(next,{onConflict:"user_id"});
  if (error) throw error;
  privacySettings = { ...privacySettings, ...next };
  privacySettingsLoaded = true;
  lastSeenExclusionsArea.hidden = next.last_seen_visibility !== "contacts_except";
  groupAddExclusionsArea.hidden = next.group_add_visibility !== "contacts_except";
  profilePhotoExclusionsArea.hidden = next.profile_photo_visibility !== "contacts_except";
  aboutExclusionsArea.hidden = next.about_visibility !== "contacts_except";
  statusExclusionsArea.hidden = !["contacts_except","only_share"].includes(next.status_visibility);
  statusAudienceHelp.textContent = next.status_visibility === "only_share"
    ? "حدد الأشخاص الذين سيتمكنون من مشاهدة حالاتك فقط."
    : "حدد الأشخاص الذين لن يتمكنوا من مشاهدة حالاتك.";
  announce("تم حفظ إعدادات الخصوصية.");
  await refreshVisiblePresence().catch(error => console.warn("تعذر تحديث الحضور بعد حفظ الخصوصية:", error.message));
  renderPeople();
  if (!privacySettings.read_receipts_enabled && !activeConversation?.is_group) {
    messagesList.querySelectorAll(".message-read-state").forEach(node => node.remove());
  } else if (activeConversation) {
    await loadMessages();
  }
  if (notifications.length) renderNotifications();
}
async function loadPrivacyContacts() {
  if (!people.length) await loadPeople();
  const { data, error } = await supabase.from("conversations")
    .select("user_one,user_two")
    .eq("is_group", false)
    .or("user_one.eq." + currentUser.id + ",user_two.eq." + currentUser.id);
  if (error) throw error;
  const contactIds = new Set((data || []).map(row => row.user_one === currentUser.id ? row.user_two : row.user_one));
  return people.filter(person => contactIds.has(person.id));
}
async function renderChoiceList(list, selectedSet, title, focusTarget) {
  privacyContactPickerList.replaceChildren();
  privacyContactPickerTitle.textContent = title;
  const contacts = await loadPrivacyContacts();
  if (!contacts.length) {
    privacyContactPickerList.append(safeText("li","empty-item","لا توجد جهات اتصال في مرسال للاختيار منها."));
  } else {
    for (const person of contacts) {
      const li=document.createElement("li"),choice=document.createElement("label"),cb=document.createElement("input");
      choice.className="privacy-person-choice"; cb.type="checkbox"; cb.checked=selectedSet.has(person.id);
      cb.setAttribute("aria-label",displayName(person));
      cb.addEventListener("change",()=>{if(cb.checked)selectedSet.add(person.id);else selectedSet.delete(person.id);updatePrivacySaveButtons();});
      choice.append(cb,document.createTextNode(displayName(person))); li.append(choice); privacyContactPickerList.append(li);
    }
  }
  privacyContactPicker.hidden=false;
  document.body.classList.add("privacy-contact-picker-open");
  closePrivacyContactPickerButton.focus();
  activePrivacyPicker={focusTarget};
}
function closePrivacyContactPicker(restoreSelection=true) {
  if (!activePrivacyPicker) return;
  if (restoreSelection) {
    const key=activePrivacyPicker.key;
    if (key==="status") selectedStatusExclusions=new Set(storedStatusExclusions);
    else {
      const state=getPrivacyExclusionState(key);
      state.selected.clear(); for(const id of state.stored) state.selected.add(id);
    }
  }
  privacyContactPicker.hidden=true;
  document.body.classList.remove("privacy-contact-picker-open");
  const target=activePrivacyPicker.focusTarget;
  activePrivacyPicker=null;
  updatePrivacySaveButtons();
  target?.focus();
}
function privacySelectionChanged(selected, stored) {
  return selected.size !== stored.size || [...selected].some(id => !stored.has(id));
}
function updatePrivacySaveButtons() {
  const states = {
    last_seen: privacySelectionChanged(selectedLastSeenExclusions, storedLastSeenExclusions),
    group_add: privacySelectionChanged(selectedGroupAddExclusions, storedGroupAddExclusions),
    profile_photo: privacySelectionChanged(selectedProfilePhotoExclusions, storedProfilePhotoExclusions),
    about: privacySelectionChanged(selectedAboutExclusions, storedAboutExclusions),
    status: privacySelectionChanged(selectedStatusExclusions, storedStatusExclusions)
  };
  for (const [key, button] of Object.entries({
    last_seen: saveLastSeenExclusionsButton,
    group_add: saveGroupAddExclusionsButton,
    profile_photo: saveProfilePhotoExclusionsButton,
    about: saveAboutExclusionsButton,
    status: saveStatusExclusionsButton
  })) {
    if (button) button.disabled = !states[key] || privacySaveInProgress.has(key);
  }
  if (savePrivacyContactPickerButton) {
    const key = activePrivacyPicker?.key;
    savePrivacyContactPickerButton.disabled = !key || !states[key] || privacySaveInProgress.has(key);
  }
}
function getPrivacyExclusionState(settingKey) {
  const map = {
    last_seen:{list:lastSeenExclusionsList,selected:selectedLastSeenExclusions,stored:storedLastSeenExclusions},
    group_add:{list:groupAddExclusionsList,selected:selectedGroupAddExclusions,stored:storedGroupAddExclusions},
    profile_photo:{list:profilePhotoExclusionsList,selected:selectedProfilePhotoExclusions,stored:storedProfilePhotoExclusions},
    about:{list:aboutExclusionsList,selected:selectedAboutExclusions,stored:storedAboutExclusions}
  };
  if(!map[settingKey])throw new Error("إعداد الخصوصية غير معروف.");
  return map[settingKey];
}
async function renderPrivacyExclusionChoices(settingKey, openPicker=true) {
  const {list,selected,stored}=getPrivacyExclusionState(settingKey);
  const {data,error}=await supabase.from("privacy_exclusions").select("excluded_user_id").eq("owner_id",currentUser.id).eq("setting_key",settingKey);
  if(error)throw error;
  stored.clear(); for(const row of data||[])stored.add(row.excluded_user_id);
  selected.clear(); for(const id of stored)selected.add(id);
  if(openPicker){
    await renderChoiceList(list,selected,({last_seen:"استثناءات آخر ظهور",group_add:"استثناءات إضافتك إلى المجموعات",profile_photo:"استثناءات صورة ملفك الشخصي",about:"استثناءات النبذة"})[settingKey],({last_seen:privacyLastSeenSelect,group_add:privacyGroupAddSelect,profile_photo:privacyProfilePhotoSelect,about:privacyAboutSelect})[settingKey]);
    activePrivacyPicker.key=settingKey;
    updatePrivacySaveButtons();
  }
}
async function savePrivacyExclusionChoices(settingKey) {
  const {selected,stored}=getPrivacyExclusionState(settingKey);
  if (!privacySelectionChanged(selected, stored) || privacySaveInProgress.has(settingKey)) return;
  privacySaveInProgress.add(settingKey);
  updatePrivacySaveButtons();
  try {
  const added=[...selected].filter(id=>!stored.has(id));
  if(added.length){
    const {error}=await supabase.from("privacy_exclusions").insert(added.map(excluded_user_id=>({owner_id:currentUser.id,excluded_user_id,setting_key:settingKey})));
    if(error)throw error;
  }
  const removed=[...stored].filter(id=>!selected.has(id));
  if(removed.length){
    const {error}=await supabase.from("privacy_exclusions").delete().eq("owner_id",currentUser.id).eq("setting_key",settingKey).in("excluded_user_id",removed);
    if(error)throw error;
  }
  stored.clear(); for(const id of selected)stored.add(id);
  if(settingKey==="last_seen"){await refreshVisiblePresence().catch(()=>{});renderPeople();}
  if(settingKey==="profile_photo"){await Promise.all([loadPeople(),loadConversations()]);}
  if(settingKey==="about"&&activePartner)await updateConversationInfo();
  announce("تم حفظ الاستثناءات.");
  closePrivacyContactPicker(false);
  } finally {
    privacySaveInProgress.delete(settingKey);
    updatePrivacySaveButtons();
  }
}

async function renderStatusAudienceChoices(openPicker=true) {
  if (!currentUser) return;
  const isOnlyShare = privacyStatusSelect.value === "only_share";
  const table = isOnlyShare ? "status_privacy_inclusions" : "status_privacy_exclusions";
  const idColumn = isOnlyShare ? "included_user_id" : "excluded_user_id";
  const {data,error}=await supabase.from(table).select(idColumn).eq("owner_id",currentUser.id);
  if(error)throw error;
  storedStatusExclusions = new Set((data||[]).map(row=>row[idColumn]));
  selectedStatusExclusions = new Set(storedStatusExclusions);
  if(openPicker){
    await renderChoiceList(statusExclusionsList,selectedStatusExclusions,privacySettings.status_visibility==="only_share"?"اختيار من يستطيع مشاهدة حالاتك":"استثناءات مشاهدة الحالات",privacyStatusSelect);
    activePrivacyPicker.key="status";
    updatePrivacySaveButtons();
  }
}
async function saveStatusExclusions() {
  if (!currentUser) return;
  if (!privacySelectionChanged(selectedStatusExclusions, storedStatusExclusions) || privacySaveInProgress.has("status")) return;
  privacySaveInProgress.add("status");
  updatePrivacySaveButtons();
  try {
    const isOnlyShare=privacySettings.status_visibility==="only_share";
    const table=isOnlyShare?"status_privacy_inclusions":"status_privacy_exclusions";
    const idColumn=isOnlyShare?"included_user_id":"excluded_user_id";
    const added=[...selectedStatusExclusions].filter(id=>!storedStatusExclusions.has(id));
    if(added.length){
      const {error}=await supabase.from(table).insert(added.map(id=>({owner_id:currentUser.id,[idColumn]:id})));
      if(error)throw error;
    }
    const removed=[...storedStatusExclusions].filter(id=>!selectedStatusExclusions.has(id));
    if(removed.length){
      const {error}=await supabase.from(table).delete().eq("owner_id",currentUser.id).in(idColumn,removed);
      if(error)throw error;
    }
    storedStatusExclusions=new Set(selectedStatusExclusions);
    announce("تم حفظ جمهور الحالات.");
    closePrivacyContactPicker(false);
  } catch(error){announce("تعذر حفظ جمهور الحالات: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{privacySaveInProgress.delete("status");updatePrivacySaveButtons();}
}
async function renderBlockedUsers() {
  if (!currentUser) return;
  const {data,error}=await supabase.from("user_blocks").select("blocked_id").eq("blocker_id",currentUser.id);
  if(error)throw error;
  blockedUsersList.replaceChildren();
  const ids=(data||[]).map(row=>row.blocked_id);
  if(!ids.length){blockedUsersList.append(safeText("li","empty-item","لا يوجد أشخاص محظورون."));return;}
  const {data:profiles,error:profileError}=await supabase.from("profiles").select("id,display_name").in("id",ids);
  if(profileError)throw profileError;
  const names=new Map((profiles||[]).map(row=>[row.id,row.display_name]));
  for(const id of ids){
    const li=document.createElement("li"),row=document.createElement("div");
    row.className="blocked-user-row"; row.append(safeText("span","blocked-user-name",names.get(id)||"مستخدم مرسال"));
    const button=safeText("button","quiet-button","إلغاء الحظر"); button.type="button";
    button.addEventListener("click",async()=>{
      button.disabled=true;
      const result=await supabase.from("user_blocks").delete().eq("blocker_id",currentUser.id).eq("blocked_id",id);
      if(result.error){button.disabled=false;announce("تعذر إلغاء الحظر: "+result.error.message,"error");return;}
      await renderBlockedUsers(); announce("تم إلغاء الحظر.");
    });
    row.append(button);li.append(row);blockedUsersList.append(li);
  }
}

function openSettings() {
  if (!currentUser) return;
  statusView.hidden = true;
  document.body.classList.remove("status-open");
  settingsReturnFocus = document.activeElement;
  settingsEmail.value = currentUser.email || "";
  textSizeSelect.value = localStorage.getItem("mersal-text-size") || "normal";
  themeSelect.value = localStorage.getItem("mersal-theme") || "system";
  settingsLanguageSelect.value = localStorage.getItem("mersal-language") || "ar";
  applyTextSize(textSizeSelect.value);
  applyTheme(themeSelect.value);
  settingsHome.hidden = false;
  generalSettingsView.hidden = true;
  privacySettingsView.hidden = true;
  chatsSettingsView.hidden = true;
  profileSettingsView.hidden = true;
  accountSettingsView.hidden = true;
  settingsPanel.hidden = false;
  document.body.classList.add("settings-open");
  setActiveBottomTab("settings");
  $("#open-account-settings").focus();
}
async function loadOwnProfile() {
  const [{data,error},visibleProfile] = await Promise.all([
    supabase.from("profiles").select("display_name,avatar_url").eq("id",currentUser.id).maybeSingle(),
    supabase.rpc("get_visible_profiles",{p_user_ids:[currentUser.id]})
  ]);
  if(error)throw error;
  if(visibleProfile.error)throw visibleProfile.error;
  displayNameInput.value=data?.display_name||currentUser.email?.split("@")[0]||"";
  settingsAboutInput.value=visibleProfile.data?.[0]?.about||"";
  profileSavedSnapshot = getProfileFormSnapshot();
  updateProfileSaveButton();
  currentProfilePhotoPath = data?.avatar_url && !/^https?:\/\//i.test(data.avatar_url) ? data.avatar_url : null;
  currentProfilePhotoExternal = Boolean(data?.avatar_url && !currentProfilePhotoPath);
  const ownPhoto = await resolveProfileAvatar({ avatar_url: data?.avatar_url || null });
  setProfilePhotoPreview(ownPhoto?.avatar_url || null);
}
openDeveloperContactButton.addEventListener("click", () => {
  developerContactReturnFocus = document.activeElement;
  developerContactPanel.hidden = false;
  document.body.classList.add("developer-contact-open");
  closeDeveloperContactButton.focus();
});
closeDeveloperContactButton.addEventListener("click", () => {
  developerContactPanel.hidden = true;
  document.body.classList.remove("developer-contact-open");
  (developerContactReturnFocus || openDeveloperContactButton).focus();
});
developerContactPanel.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    developerContactPanel.hidden = true;
    document.body.classList.remove("developer-contact-open");
    (developerContactReturnFocus || openDeveloperContactButton).focus();
  }
});
settingsLanguageSelect.addEventListener("change", () => {
  applyMersalLanguage(settingsLanguageSelect.value);
  announce(settingsLanguageSelect.value==="en"?"تم تغيير اللغة إلى الإنجليزية.":"تم تغيير اللغة إلى العربية.");
});
settingsTabButton.addEventListener("click", openSettings);
statusTabButton.addEventListener("click", openStatusTab);
homeTabButton.addEventListener("click", returnToHomeTab);
openGeneralSettingsButton.addEventListener("click", () => {
  settingsHome.hidden = true; accountSettingsView.hidden = true; profileSettingsView.hidden = true; privacySettingsView.hidden = true; chatsSettingsView.hidden = true;
  generalSettingsView.hidden = false; backGeneralSettingsButton.focus();
});
openChatsSettingsButton.addEventListener("click", () => {
  settingsHome.hidden = true; accountSettingsView.hidden = true; profileSettingsView.hidden = true; privacySettingsView.hidden = true; generalSettingsView.hidden = true;
  loadChatSettings();
  chatsSettingsView.hidden = false;
  chatMessageTextSizeSelect.focus();
});
backChatsSettingsButton.addEventListener("click", () => {
  chatsSettingsView.hidden = true;
  settingsHome.hidden = false;
  openChatsSettingsButton.focus();
});
chatsSettingsView.addEventListener("keydown", event => {
  if (event.key === "Escape") backChatsSettingsButton.click();
});
chatMessageTextSizeSelect.addEventListener("change", () => {
  applyChatMessageTextSize(chatMessageTextSizeSelect.value);
  announce("تم تحديث حجم نص الرسائل.");
});
chatEnterToSendInput.addEventListener("change", () => {
  localStorage.setItem("mersal-chat-enter-to-send", String(chatEnterToSendInput.checked));
  announce(chatEnterToSendInput.checked ? "تم تشغيل الإرسال بالضغط على Enter." : "تم إيقاف الإرسال بالضغط على Enter.");
});
chatConfirmDeleteInput.addEventListener("change", () => {
  localStorage.setItem("mersal-chat-confirm-delete", String(chatConfirmDeleteInput.checked));
  announce(chatConfirmDeleteInput.checked ? "تم تشغيل تأكيد حذف الرسائل." : "تم إيقاف تأكيد حذف الرسائل.");
});
chatShowMessageTimeInput.addEventListener("change", () => {
  applyChatMessageTimeVisibility(chatShowMessageTimeInput.checked);
  announce(chatShowMessageTimeInput.checked ? "تم تشغيل إظهار وقت الرسائل." : "تم إيقاف إظهار وقت الرسائل.");
});
chatCompactLayoutInput.addEventListener("change", () => {
  applyChatCompactLayout(chatCompactLayoutInput.checked);
  announce(chatCompactLayoutInput.checked ? "تم تفعيل العرض المضغوط للرسائل." : "تم إيقاف العرض المضغوط للرسائل.");
});
privacySettingsView.addEventListener("keydown", event => {
  if (event.key === "Escape") backPrivacySettingsButton.click();
});
openPrivacySettingsButton.addEventListener("click", async () => {
  settingsHome.hidden=true; accountSettingsView.hidden=true; profileSettingsView.hidden=true; generalSettingsView.hidden=true; chatsSettingsView.hidden=true;
  privacySettingsView.hidden=false;
  try { await loadPrivacySettings(); privacyLastSeenSelect.focus(); }
  catch(error){announce("تعذر تحميل إعدادات الخصوصية: "+error.message,"error");}
});
backPrivacySettingsButton.addEventListener("click",()=>{privacySettingsView.hidden=true;settingsHome.hidden=false;openPrivacySettingsButton.focus();});
for(const control of [privacyLastSeenSelect,privacyOnlineSelect,privacyReadReceiptsInput,privacyGroupAddSelect,privacyHidePreviewInput,privacyStatusSelect,privacyProfilePhotoSelect,privacyAboutSelect]){
  control.addEventListener("change",async()=>{
    try{
      await savePrivacySettings();
      if(control===privacyLastSeenSelect && privacyLastSeenSelect.value==="contacts_except")await renderPrivacyExclusionChoices("last_seen");
      if(control===privacyGroupAddSelect && privacyGroupAddSelect.value==="contacts_except")await renderPrivacyExclusionChoices("group_add");
      if(control===privacyProfilePhotoSelect && privacyProfilePhotoSelect.value==="contacts_except")await renderPrivacyExclusionChoices("profile_photo");
      if(control===privacyAboutSelect && privacyAboutSelect.value==="contacts_except")await renderPrivacyExclusionChoices("about");
      if(control===privacyStatusSelect && ["contacts_except","only_share"].includes(privacyStatusSelect.value))await renderStatusAudienceChoices();
    }catch(error){
      privacyLastSeenSelect.value=privacySettings.last_seen_visibility;
      privacyOnlineSelect.value=["everyone","same_as_last_seen"].includes(privacySettings.online_visibility)?privacySettings.online_visibility:"same_as_last_seen";
      privacyReadReceiptsInput.checked=privacySettings.read_receipts_enabled;
      privacyGroupAddSelect.value=privacySettings.group_add_visibility;
      privacyHidePreviewInput.checked=privacySettings.hide_notification_preview;
      privacyStatusSelect.value=privacySettings.status_visibility;
      privacyProfilePhotoSelect.value=privacySettings.profile_photo_visibility||"everyone";
      privacyAboutSelect.value=privacySettings.about_visibility||"everyone";
      profilePhotoExclusionsArea.hidden=privacySettings.profile_photo_visibility!=="contacts_except";
      aboutExclusionsArea.hidden=privacySettings.about_visibility!=="contacts_except";
      lastSeenExclusionsArea.hidden=privacySettings.last_seen_visibility!=="contacts_except";
      groupAddExclusionsArea.hidden=privacySettings.group_add_visibility!=="contacts_except";
      statusExclusionsArea.hidden=!["contacts_except","only_share"].includes(privacySettings.status_visibility);
      statusAudienceHelp.textContent=privacySettings.status_visibility==="only_share"
        ? "حدد الأشخاص الذين سيتمكنون من مشاهدة حالاتك فقط."
        : "حدد الأشخاص الذين لن يتمكنوا من مشاهدة حالاتك.";
      announce("تعذر حفظ إعداد الخصوصية: "+error.message,"error");
    }
  });
}
saveLastSeenExclusionsButton.addEventListener("click",()=>void savePrivacyExclusionChoices("last_seen").catch(error=>announce("تعذر الحفظ: "+error.message,"error")));
saveGroupAddExclusionsButton.addEventListener("click",()=>void savePrivacyExclusionChoices("group_add").catch(error=>announce("تعذر الحفظ: "+error.message,"error")));
saveProfilePhotoExclusionsButton.addEventListener("click",()=>void savePrivacyExclusionChoices("profile_photo").catch(error=>announce("تعذر الحفظ: "+error.message,"error")));
saveAboutExclusionsButton.addEventListener("click",()=>void savePrivacyExclusionChoices("about").catch(error=>announce("تعذر الحفظ: "+error.message,"error")));
saveStatusExclusionsButton.addEventListener("click",()=>{void saveStatusExclusions();});
closePrivacyContactPickerButton.addEventListener("click",()=>closePrivacyContactPicker(true));
savePrivacyContactPickerButton.addEventListener("click",()=>{
  if(!activePrivacyPicker)return;
  if(activePrivacyPicker.key==="status") void saveStatusExclusions();
  else void savePrivacyExclusionChoices(activePrivacyPicker.key).catch(error=>announce("تعذر الحفظ: "+error.message,"error"));
});
backGeneralSettingsButton.addEventListener("click", () => {
  generalSettingsView.hidden = true;
  settingsHome.hidden = false;
  openGeneralSettingsButton.focus();
});
openProfileSettingsButton.addEventListener("click", async () => {
  settingsHome.hidden = true; accountSettingsView.hidden = true; generalSettingsView.hidden = true; privacySettingsView.hidden = true; chatsSettingsView.hidden = true;
  profileSettingsView.hidden = false;
  try { await loadOwnProfile(); displayNameInput.focus(); }
  catch (error) { announce("تعذر تحميل الملف الشخصي: " + error.message, "error"); }
});
backProfileSettingsButton.addEventListener("click", () => {
  profileSettingsView.hidden = true; settingsHome.hidden = false; openProfileSettingsButton.focus();
});
$("#open-account-settings").addEventListener("click", () => {
  settingsHome.hidden = true; generalSettingsView.hidden = true; privacySettingsView.hidden = true; chatsSettingsView.hidden = true; profileSettingsView.hidden = true;
  accountSettingsView.hidden = false; settingsEmail.focus();
});
$("#back-settings-home").addEventListener("click", () => { accountSettingsView.hidden = true; settingsHome.hidden = false; $("#open-account-settings").focus(); });
accountLogoutButton.addEventListener("click", async () => {
  accountLogoutButton.disabled = true;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) announce("تعذر تسجيل الخروج: " + error.message, "error");
  else {
    settingsPanel.hidden = true;
    showLoggedOut("تم تسجيل الخروج.");
  }
  accountLogoutButton.disabled = false;
});
function openDeleteAccountPanel() {
  deleteAccountConfirmation.value = "";
  confirmDeleteAccountButton.disabled = true;
  deleteAccountPanel.hidden = false;
  deleteAccountConfirmation.focus();
}
function closeDeleteAccountPanel() {
  deleteAccountPanel.hidden = true;
  deleteAccountButton.focus();
}
deleteAccountButton.addEventListener("click", openDeleteAccountPanel);
closeDeleteAccountButton.addEventListener("click", closeDeleteAccountPanel);
cancelDeleteAccountButton.addEventListener("click", closeDeleteAccountPanel);
deleteAccountConfirmation.addEventListener("input", () => {
  confirmDeleteAccountButton.disabled = deleteAccountConfirmation.value.trim() !== "حذف حسابي";
});
deleteAccountPanel.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDeleteAccountPanel();
});
confirmDeleteAccountButton.addEventListener("click", async () => {
  if (!currentUser || deleteAccountConfirmation.value.trim() !== "حذف حسابي") return;
  confirmDeleteAccountButton.disabled = true;
  closeDeleteAccountButton.disabled = true;
  cancelDeleteAccountButton.disabled = true;
  try {
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "حذف حسابي" }
    });
    if (error) throw error;
    deleteAccountPanel.hidden = true;
    await supabase.auth.signOut();
    showLoggedOut("تم حذف الحساب نهائيًا.");
  } catch (error) {
    announce("تعذر حذف الحساب: " + (error?.message || "حاول مرة أخرى."), "error");
    confirmDeleteAccountButton.disabled = false;
  } finally {
    closeDeleteAccountButton.disabled = false;
    cancelDeleteAccountButton.disabled = false;
  }
});
settingsPanel.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!profileSettingsView.hidden) {
    profileSettingsView.hidden = true;
    settingsHome.hidden = false;
    openProfileSettingsButton.focus();
    return;
  }
  if (!accountSettingsView.hidden) {
    accountSettingsView.hidden = true;
    settingsHome.hidden = false;
    $("#open-account-settings").focus();
    return;
  }
  if (!chatsSettingsView.hidden) {
    chatsSettingsView.hidden = true;
    settingsHome.hidden = false;
    openChatsSettingsButton.focus();
    return;
  }
  if (!privacySettingsView.hidden) {
    privacySettingsView.hidden = true;
    settingsHome.hidden = false;
    openPrivacySettingsButton.focus();
    return;
  }
  if (!generalSettingsView.hidden) {
    generalSettingsView.hidden = true;
    settingsHome.hidden = false;
    openGeneralSettingsButton.focus();
    return;
  }
  settingsPanel.hidden = true;
  document.body.classList.remove("settings-open");
  setActiveBottomTab("home");
  settingsReturnFocus?.focus?.();
});
textSizeSelect.addEventListener("change", () => {
  applyTextSize(textSizeSelect.value);
  localStorage.setItem("mersal-text-size", textSizeSelect.value);
});
themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
  localStorage.setItem("mersal-theme", themeSelect.value);
});
window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if ((localStorage.getItem("mersal-theme") || "system") === "system") applyTheme("system");
});
chooseProfilePhotoButton.addEventListener("click", () => profilePhotoInput.click());
profilePhotoInput.addEventListener("change", async () => {
  const file = profilePhotoInput.files?.[0];
  profilePhotoInput.value = "";
  if (!file || !currentUser) return;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    announce("اختر صورة بصيغة JPG أو PNG أو WebP أو GIF.", "error");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    announce("حجم الصورة يجب ألا يتجاوز 50 ميغابايت.", "error");
    return;
  }
  chooseProfilePhotoButton.disabled = true;
  removeProfilePhotoButton.disabled = true;
  announce("جارٍ رفع الصورة الشخصية…");
  let uploadedPath = null;
  let profileUpdated = false;
  try {
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[file.type];
    uploadedPath = currentUser.id + "/" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await supabase.storage.from("mersal-profile-photos").upload(uploadedPath, file, {
      contentType: file.type, upsert: false
    });
    if (uploadError) throw uploadError;
    const { data: signed, error: signedError } = await supabase.storage.from("mersal-profile-photos").createSignedUrl(uploadedPath, 3600);
    if (signedError) throw signedError;
    const { error: updateError } = await supabase.from("profiles").update({
      avatar_url: uploadedPath, updated_at: new Date().toISOString()
    }).eq("id", currentUser.id);
    if (updateError) throw updateError;
    profileUpdated = true;
    const previousPath = currentProfilePhotoPath;
    currentProfilePhotoPath = uploadedPath;
    currentProfilePhotoExternal = false;
    setProfilePhotoPreview(signed.signedUrl);
    if (previousPath && previousPath !== uploadedPath) {
      const { error: removeError } = await supabase.storage.from("mersal-profile-photos").remove([previousPath]);
      if (removeError) console.warn("تعذر حذف الصورة السابقة:", removeError.message);
    }
    await Promise.all([loadPeople(), loadConversations()]);
    announce("تم تحديث الصورة الشخصية.");
  } catch (error) {
    if (uploadedPath && !profileUpdated) await supabase.storage.from("mersal-profile-photos").remove([uploadedPath]).catch(() => {});
    announce("تعذر رفع الصورة الشخصية: " + (error.message || "حاول مرة أخرى."), "error");
  } finally {
    chooseProfilePhotoButton.disabled = false;
    removeProfilePhotoButton.disabled = false;
  }
});
removeProfilePhotoButton.addEventListener("click", async () => {
  if (!currentUser || (!currentProfilePhotoPath && !currentProfilePhotoExternal)) return;
  removeProfilePhotoButton.disabled = true;
  chooseProfilePhotoButton.disabled = true;
  try {
    const previousPath = currentProfilePhotoPath;
    const { error } = await supabase.from("profiles").update({
      avatar_url: null, updated_at: new Date().toISOString()
    }).eq("id", currentUser.id);
    if (error) throw error;
    if (previousPath) {
      const { error: removeError } = await supabase.storage.from("mersal-profile-photos").remove([previousPath]);
      if (removeError) console.warn("تعذر حذف ملف الصورة السابقة:", removeError.message);
    }
    currentProfilePhotoPath = null;
    currentProfilePhotoExternal = false;
    setProfilePhotoPreview(null);
    await Promise.all([loadPeople(), loadConversations()]);
    announce("تمت إزالة الصورة الشخصية.");
  } catch (error) {
    announce("تعذرت إزالة الصورة الشخصية: " + (error.message || "حاول مرة أخرى."), "error");
  } finally {
    removeProfilePhotoButton.disabled = false;
    chooseProfilePhotoButton.disabled = false;
  }
});
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const name = displayNameInput.value.trim();
  const about = settingsAboutInput.value.trim();
  if(about.length>200){announce("النبذة يجب ألا تتجاوز 200 حرفًا.","error");settingsAboutInput.focus();return;}
  if (name.length < 2 || name.length > 40) {
    announce("الاسم يجب أن يكون بين حرفين و40 حرفًا.", "error");
    displayNameInput.focus();
    return;
  }
  if (profileSavedSnapshot === getProfileFormSnapshot() || profileSaveInProgress) return;
  profileSaveInProgress = true;
  updateProfileSaveButton();
  announce("جارٍ حفظ إعدادات الحساب…");
  try {
    const { error } = await supabase.from("profiles").update({
      display_name: name, about, updated_at: new Date().toISOString()
    }).eq("id", currentUser.id);
    if (error) throw error;
    // Keep the user on the profile screen after saving. Refresh related views.
    profileSavedSnapshot = getProfileFormSnapshot();
    const refreshResults = await Promise.allSettled([loadPeople(), loadConversations()]);
    announce(
      refreshResults.some(result => result.status === "rejected")
        ? "تم حفظ الملف الشخصي. قد تحتاج بعض القوائم إلى تحديث."
        : "تم حفظ الملف الشخصي.",
      "success"
    );
  } catch (error) {
    announce("تعذر حفظ الملف الشخصي: " + (error.message || "حاول مرة أخرى."), "error");
  } finally {
    profileSaveInProgress = false;
    updateProfileSaveButton();
  }
});
applyTextSize(localStorage.getItem("mersal-text-size") || "normal");
applyTheme(localStorage.getItem("mersal-theme") || "system");

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true;
  announce("جارٍ فتح Google لتسجيل الدخول…");
  try {
    const redirectTo = new URL("/", window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) throw error;
  } catch (error) {
    announce("تعذر بدء تسجيل الدخول: " + (error?.message || "خطأ غير معروف"), "error");
    loginButton.disabled = false;
  }
});

supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
      void handleSession(session, event);
    }
  }, 0);
});

async function loadPeople() {
  const { data, error } = await supabase.from("profiles")
    .select("id,display_name")
    .neq("id", currentUser.id)
    .order("display_name", { ascending: true })
    .limit(100);
  if (error) throw error;
  const ids=(data||[]).map(person=>person.id);
  let visibleProfiles=[];
  if(ids.length){
    const result=await supabase.rpc("get_visible_profiles",{p_user_ids:ids});
    if(result.error)throw result.error;
    visibleProfiles=result.data||[];
  }
  visibleProfiles = await resolveProfileAvatars(visibleProfiles);
  const visibleMap=new Map(visibleProfiles.map(profile=>[profile.id,profile]));
  people=(data||[]).map(person=>({...person,...(visibleMap.get(person.id)||{})}));
  renderPeople();
}

function renderPeople() {
 const term=peopleSearch.value.trim().toLocaleLowerCase();peopleList.replaceChildren();
 const filtered=people.filter(p=>displayName(p).toLocaleLowerCase().includes(term));
 if(!filtered.length){peopleList.append(safeText("li","empty-item","لا يوجد أشخاص بهذا الاسم."));return;}
 for(const person of filtered){
   const item=document.createElement("li"),button=document.createElement("button");
   button.type="button";button.className="person-button";
   appendProfileAvatar(button,person);
   button.append(safeText("span","person-button-name",displayName(person)));
   if(onlineUserIds.has(person.id))button.append(safeText("span","person-button-presence","متصل الآن"));
   button.addEventListener("click",()=>{closeNewChat();void openConversation(person);});
   item.append(button);peopleList.append(item);
 }
}
function renderGroupPeople(){
 const term=groupPeopleSearch.value.trim().toLocaleLowerCase();groupPeopleList.replaceChildren();
 const filtered=people.filter(p=>displayName(p).toLocaleLowerCase().includes(term));
 if(!filtered.length){groupPeopleList.append(safeText("li","empty-item","لا يوجد أشخاص بهذا الاسم."));return;}
 for(const person of filtered){
   const item=document.createElement("li"),label=document.createElement("label");
   label.className="group-person-choice";
   const cb=document.createElement("input");cb.type="checkbox";cb.checked=selectedGroupMembers.has(person.id);
   cb.addEventListener("change",()=>{if(cb.checked)selectedGroupMembers.add(person.id);else selectedGroupMembers.delete(person.id);});
   label.append(cb);
   appendProfileAvatar(label,person);
   label.append(document.createTextNode(displayName(person)));
   item.append(label);groupPeopleList.append(item);
 }
}
function openNewChat(){newChatReturnFocus=newChatButton;newChatPanel.hidden=false;privateChatView.hidden=true;groupChatView.hidden=true;newPrivateChatButton.hidden=false;newGroupChatButton.hidden=false;closeNewChatButton.focus();}
function closeNewChat(){newChatPanel.hidden=true;if(newChatReturnFocus?.isConnected)newChatReturnFocus.focus();}
newChatButton.addEventListener("click",openNewChat);closeNewChatButton.addEventListener("click",closeNewChat);
newChatPanel.addEventListener("keydown",e=>{if(e.key==="Escape")closeNewChat();});
newPrivateChatButton.addEventListener("click",()=>{privateChatView.hidden=false;groupChatView.hidden=true;newPrivateChatButton.hidden=true;newGroupChatButton.hidden=true;peopleSearch.value="";renderPeople();peopleSearch.focus();});
newGroupChatButton.addEventListener("click",()=>{selectedGroupMembers.clear();groupNameInput.value="";groupPeopleSearch.value="";privateChatView.hidden=true;groupChatView.hidden=false;newPrivateChatButton.hidden=true;newGroupChatButton.hidden=true;renderGroupPeople();groupNameInput.focus();});
peopleSearch.addEventListener("input",renderPeople);groupPeopleSearch.addEventListener("input",renderGroupPeople);
createGroupButton.addEventListener("click",async()=>{
 if(!currentUser)return;const ids=[...selectedGroupMembers],name=groupNameInput.value.trim();
 if(!name){announce("اكتب اسم المجموعة.","error");groupNameInput.focus();return;}
 if(ids.length<1){announce("اختر شخصًا واحدًا على الأقل لإنشاء المجموعة.","error");return;}
 createGroupButton.disabled=true;
 try{
  const {data:conv,error}=await supabase.from("conversations").insert({user_one:currentUser.id,user_two:ids[0],is_group:true,group_name:name}).select("id,user_one,user_two,last_message_at,is_group,group_name,created_at").single();if(error)throw error;
  const rows=[currentUser.id,...ids].map(user_id=>({conversation_id:conv.id,user_id,role:user_id===currentUser.id?"admin":"member"}));
  const {error:memberError}=await supabase.from("conversation_members").insert(rows);
  if(memberError){
    await supabase.rpc("delete_group",{p_conversation_id:conv.id,p_delete_for_everyone:true}).catch(()=>{});
    if(memberError.code==="42501")throw new Error("تعذر إضافة أحد الأشخاص؛ قد تمنع إعدادات الخصوصية أو الحظر إضافته مباشرة إلى المجموعة.");
    throw memberError;
  }
  const {data:person,error:profileError}=await supabase.from("profiles").select("id,display_name").eq("id",ids[0]).single();if(profileError)throw profileError;
  await selectConversation(conv,{...person,display_name:name});await loadConversations();closeNewChat();announce("تم إنشاء المجموعة.","success");
 }catch(error){announce("تعذر إنشاء المجموعة: "+(error.message||"حاول مرة أخرى."),"error");}finally{createGroupButton.disabled=false;}
});


let selectedStatusKind = "text";
let selectedStatusFile = null;
let statusExpiryTimer = null;
let statusViewerReturnFocus = null;
let activeViewedStatus = null;
function statusKindLabel(kind) { return kind === "image" ? "صورة" : kind === "video" ? "فيديو" : "نص"; }
function statusTimeLabel(value) {
  return new Date(value).toLocaleString("ar-JO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
async function loadStatuses() {
  if (!currentUser || !statusList) return;
  if (statusExpiryTimer) clearTimeout(statusExpiryTimer);
  const { data, error } = await supabase.from("statuses")
    .select("id,user_id,kind,content,media_path,media_type,created_at,expires_at")
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const nextExpiry = rows.reduce((nearest, row) => Math.min(nearest, new Date(row.expires_at).getTime()), Infinity);
  if (Number.isFinite(nextExpiry)) {
    statusExpiryTimer = setTimeout(() => {
      void loadStatuses().catch(error => announce("تعذر تحديث الحالات: " + error.message, "error"));
    }, Math.max(1000, nextExpiry - Date.now() + 1000));
  }
  const ids = [...new Set(rows.map(row => row.user_id))];
  let profiles = new Map();
  if (ids.length) {
    const result = await supabase.from("profiles").select("id,display_name").in("id", ids);
    if (result.error) throw result.error;
    profiles = new Map((result.data || []).map(profile => [profile.id, profile]));
  }
  statusList.replaceChildren();
  if (!rows.length) { statusList.append(safeText("li", "empty-item", "لا توجد حالات حاليًا.")); return; }
  for (const row of rows) {
    const own = row.user_id === currentUser.id;
    const name = own ? "حالتي" : displayName(profiles.get(row.user_id));
    const button = safeText("button", "status-entry", name + "، " + statusKindLabel(row.kind) + "، " + statusTimeLabel(row.created_at));
    button.type = "button";
    button.addEventListener("click", () => { void openStatusViewer(row, name, button); });
    const item = document.createElement("li"); item.append(button); statusList.append(item);
  }
}
function openStatusComposer() {
  selectedStatusKind = "text"; selectedStatusFile = null;
  statusTextInput.value = ""; statusImageInput.value = ""; statusVideoInput.value = "";
  $("#status-selected-media").textContent = "";
  $("#status-text-mode").setAttribute("aria-pressed", "true");
  $("#status-image-mode").setAttribute("aria-pressed", "false");
  $("#status-video-mode").setAttribute("aria-pressed", "false");
  statusTextInput.placeholder = "اكتب حالتك";
  statusComposerPanel.hidden = false; $("#close-status-composer").focus();
}
function closeStatusComposer() { statusComposerPanel.hidden = true; $("#add-status-button").focus(); }
function setStatusKind(kind) {
  selectedStatusKind = kind; selectedStatusFile = null;
  statusImageInput.value = ""; statusVideoInput.value = "";
  $("#status-selected-media").textContent = "";
  $("#status-text-mode").setAttribute("aria-pressed", String(kind === "text"));
  $("#status-image-mode").setAttribute("aria-pressed", String(kind === "image"));
  $("#status-video-mode").setAttribute("aria-pressed", String(kind === "video"));
  statusTextInput.placeholder = kind === "text" ? "اكتب حالتك" : "أضف وصفًا اختياريًا";
  if (kind === "image") statusImageInput.click();
  if (kind === "video") statusVideoInput.click();
}
$("#add-status-button").addEventListener("click", openStatusComposer);
$("#refresh-statuses-button").addEventListener("click", () => {
  const button = $("#refresh-statuses-button"); button.disabled = true;
  void loadStatuses().then(() => announce("تم تحديث الحالات."))
    .catch(error => announce("تعذر تحديث الحالات: " + error.message, "error"))
    .finally(() => { button.disabled = false; });
});
$("#close-status-composer").addEventListener("click", closeStatusComposer);
$("#status-text-mode").addEventListener("click", () => setStatusKind("text"));
$("#status-image-mode").addEventListener("click", () => setStatusKind("image"));
$("#status-video-mode").addEventListener("click", () => setStatusKind("video"));
statusImageInput.addEventListener("change", () => {
  selectedStatusFile = statusImageInput.files?.[0] || null;
  $("#status-selected-media").textContent = selectedStatusFile ? selectedStatusFile.name : "";
});
statusVideoInput.addEventListener("change", () => {
  selectedStatusFile = statusVideoInput.files?.[0] || null;
  $("#status-selected-media").textContent = selectedStatusFile ? selectedStatusFile.name : "";
});
$("#publish-status-button").addEventListener("click", async () => {
  if (!currentUser) return;
  const content = statusTextInput.value.trim();
  if (selectedStatusKind === "text" && !content) { announce("اكتب نص الحالة أولًا.", "error"); statusTextInput.focus(); return; }
  if (selectedStatusKind !== "text" && !selectedStatusFile) { announce("اختر صورة أو فيديو أولًا.", "error"); return; }
  if (selectedStatusFile && selectedStatusFile.size > 50 * 1024 * 1024) { announce("حجم الملف أكبر من 50 ميغابايت.", "error"); return; }
  if (selectedStatusFile && !(selectedStatusKind === "image" ? selectedStatusFile.type.startsWith("image/") : selectedStatusFile.type.startsWith("video/"))) {
    announce("نوع الملف لا يطابق نوع الحالة المختار.", "error"); return;
  }
  const button = $("#publish-status-button"); button.disabled = true;
  let uploadedPath = null;
  try {
    let mediaType = null;
    if (selectedStatusFile) {
      mediaType = selectedStatusFile.type;
      const extension = String(selectedStatusFile.name || "").match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase() || "bin";
      const unique = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2);
      uploadedPath = "statuses/" + currentUser.id + "/" + unique + "." + extension;
      const upload = await supabase.storage.from("mersal-attachments").upload(uploadedPath, selectedStatusFile, { contentType: mediaType, upsert: false });
      if (upload.error) throw upload.error;
    }
    const { error } = await supabase.from("statuses").insert({
      user_id: currentUser.id, kind: selectedStatusKind, content: content || null,
      media_path: uploadedPath, media_type: mediaType,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    if (error) throw error;
    statusComposerPanel.hidden = true;
    await loadStatuses();
    $("#add-status-button").focus();
    announce("تم نشر الحالة.");
  } catch (error) {
    if (uploadedPath) await supabase.storage.from("mersal-attachments").remove([uploadedPath]);
    announce("تعذر نشر الحالة: " + (error.message || "حاول مرة أخرى."), "error");
  } finally { button.disabled = false; }
});
async function openStatusViewer(row, name, trigger) {
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await loadStatuses();
    announce("انتهت صلاحية هذه الحالة.");
    return;
  }
  statusViewerReturnFocus = trigger; activeViewedStatus = row;
  $("#status-viewer-content").replaceChildren(); $("#status-viewer-views").replaceChildren();
  $("#status-viewer-caption").textContent = row.content || "";
  $("#status-viewer-meta").textContent = name + "، " + statusTimeLabel(row.created_at);
  const own = row.user_id === currentUser.id;
  $("#delete-status-button").hidden = !own;
  if (!own && privacySettings.read_receipts_enabled) {
    const viewed = await supabase.from("status_views").insert({ status_id: row.id, viewer_id: currentUser.id });
    if (viewed.error && viewed.error.code !== "23505") console.warn("تعذر تسجيل مشاهدة الحالة:", viewed.error.message);
  }
  if (row.kind === "text") {
    $("#status-viewer-content").append(safeText("p", "status-viewer-text", row.content || ""));
  } else if (row.media_path) {
    const remaining = Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000);
    if (remaining <= 0) {
      $("#status-viewer-content").append(safeText("p", "empty-item", "انتهت صلاحية هذه الحالة."));
    } else {
      const signed = await supabase.storage.from("mersal-attachments").createSignedUrl(row.media_path, Math.min(3600, remaining));
      if (signed.error || !signed.data?.signedUrl) {
        $("#status-viewer-content").append(safeText("p", "empty-item", "تعذر فتح الحالة."));
      } else if (row.kind === "image") {
        const media = document.createElement("img"); media.src = signed.data.signedUrl;
        media.alt = "صورة الحالة من " + name; media.className = "status-viewer-image";
        $("#status-viewer-content").append(media);
      } else {
        const media = document.createElement("video"); media.src = signed.data.signedUrl;
        media.className = "status-viewer-video";
        $("#status-viewer-content").append(createInlineVideoPlayer(media, "فيديو الحالة من " + name));
      }
    }
  }
  if (own && !privacySettings.read_receipts_enabled) {
    $("#status-viewer-views").append(safeText("li","empty-item","أوقفت مؤشرات القراءة؛ لذلك لا يمكنك مشاهدة من شاهد حالتك."));
  } else if (own) {
    const result = await supabase.from("status_views").select("viewer_id,viewed_at").eq("status_id", row.id).order("viewed_at", { ascending: false });
    if (result.error) $("#status-viewer-views").append(safeText("li", "empty-item", "تعذر تحميل المشاهدات."));
    else if (!result.data?.length) $("#status-viewer-views").append(safeText("li", "empty-item", "لم يشاهدها أحد بعد."));
    else {
      const ids = [...new Set(result.data.map(view => view.viewer_id))];
      const profiles = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const names = new Map((profiles.data || []).map(profile => [profile.id, profile.display_name]));
      for (const view of result.data) $("#status-viewer-views").append(safeText("li", "status-viewer-person",
        (names.get(view.viewer_id) || "مستخدم مرسال") + "، " + statusTimeLabel(view.viewed_at)));
    }
  }
  statusViewerPanel.hidden = false; $("#close-status-viewer").focus();
}
function closeStatusViewer() {
  statusViewerPanel.hidden = true; $("#status-viewer-content").replaceChildren();
  if (statusViewerReturnFocus?.isConnected) statusViewerReturnFocus.focus();
}
$("#close-status-viewer").addEventListener("click", closeStatusViewer);
$("#delete-status-button").addEventListener("click", async () => {
  const row = activeViewedStatus; if (!row || row.user_id !== currentUser?.id) return;
  const button = $("#delete-status-button"); button.disabled = true;
  try {
    const { error } = await supabase.from("statuses").delete().eq("id", row.id).eq("user_id", currentUser.id);
    if (error) throw error;
    if (row.media_path) {
      const removed = await supabase.storage.from("mersal-attachments").remove([row.media_path]);
      if (removed.error) console.warn("تعذر حذف ملف الحالة:", removed.error.message);
    }
    closeStatusViewer();
    await loadStatuses();
    $("#add-status-button").focus();
    announce("تم حذف الحالة.");
  } catch (error) { announce("تعذر حذف الحالة: " + (error.message || "حاول مرة أخرى."), "error"); }
  finally { button.disabled = false; }
});
statusComposerPanel.addEventListener("keydown", event => { if (event.key === "Escape") closeStatusComposer(); });
statusViewerPanel.addEventListener("keydown", event => { if (event.key === "Escape") closeStatusViewer(); });

async function loadConversations() {
  const { data, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,last_message_at,is_group,group_name,created_at")
    .or("user_one.eq." + currentUser.id + ",user_two.eq." + currentUser.id)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  conversations = data || [];
  const {data: memberships, error: membershipError} = await supabase.from("conversation_members").select("conversation_id").eq("user_id",currentUser.id);
  if(membershipError) throw membershipError;
  const groupIds=(memberships||[]).map(m=>m.conversation_id);
  let groupRows=[];
  if(groupIds.length){const result=await supabase.from("conversations").select("id,user_one,user_two,last_message_at,is_group,group_name,created_at").in("id",groupIds);if(result.error)throw result.error;groupRows=result.data||[];}
  conversations=[...new Map([...conversations,...groupRows].map(c=>[c.id,c])).values()].sort((a,b)=>new Date(b.last_message_at||b.created_at||0)-new Date(a.last_message_at||a.created_at||0));
  const {data:hiddenRows,error:hiddenError}=await supabase.from("conversation_hidden_for").select("conversation_id,hidden_at").eq("user_id",currentUser.id);
  if(hiddenError)throw hiddenError;
  const hiddenMap=new Map((hiddenRows||[]).map(row=>[row.conversation_id,row.hidden_at]));
  const visibleConversations=[];
  for(const conversation of conversations){
    const hiddenAt=hiddenMap.get(conversation.id);
    if(!hiddenAt){visibleConversations.push(conversation);continue;}
    const latestAt=conversation.last_message_at||conversation.created_at||0;
    if(new Date(latestAt)>new Date(hiddenAt)){
      visibleConversations.push(conversation);
      void supabase.from("conversation_hidden_for").delete().eq("conversation_id",conversation.id).eq("user_id",currentUser.id);
    }
  }
  conversations=visibleConversations;
  void syncCallChannels().catch(error=>console.warn("Voice call channel sync:",error));
  const partnerIds = conversations.filter(c=>!c.is_group).map(c => c.user_one === currentUser.id ? c.user_two : c.user_one);
  let profileMap = new Map();
  if (partnerIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles")
      .select("id,display_name").in("id", partnerIds);
    if (profileError) throw profileError;
    const visible=await supabase.rpc("get_visible_profiles",{p_user_ids:partnerIds});
    if(visible.error)throw visible.error;
    const resolvedProfiles=await resolveProfileAvatars(visible.data||[]);
    const visibleMap=new Map(resolvedProfiles.map(profile=>[profile.id,profile]));
    profileMap=new Map((profiles||[]).map(profile=>[profile.id,{...profile,...(visibleMap.get(profile.id)||{})}]));
  }
  conversationList.replaceChildren();
  if (!conversations.length) {
    conversationList.append(safeText("li", "empty-item", "لا توجد محادثات بعد."));
    return;
  }
  const conversationIds = conversations.map(conversation => conversation.id);
  const [latestMessagesResult, unreadNotificationsResult] = await Promise.all([
    supabase.from("messages")
      .select("id,conversation_id,sender_id,body,created_at,is_deleted")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("notifications")
      .select("conversation_id")
      .eq("recipient_id", currentUser.id)
      .is("read_at", null)
      .in("conversation_id", conversationIds)
  ]);
  if (latestMessagesResult.error) throw latestMessagesResult.error;
  if (unreadNotificationsResult.error) throw unreadNotificationsResult.error;
  const latestMessageByConversation = new Map();
  for (const message of latestMessagesResult.data || []) {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message);
    }
  }
  const unreadCountByConversation = new Map();
  for (const notification of unreadNotificationsResult.data || []) {
    unreadCountByConversation.set(
      notification.conversation_id,
      (unreadCountByConversation.get(notification.conversation_id) || 0) + 1
    );
  }
  const latestMessageIds = [...latestMessageByConversation.values()].map(message => message.id);
  let hiddenMessageIds = new Set();
  if (latestMessageIds.length) {
    const { data: hiddenMessages, error: hiddenMessagesError } = await supabase.from("message_hidden_for")
      .select("message_id")
      .eq("user_id", currentUser.id)
      .in("message_id", latestMessageIds);
    if (hiddenMessagesError) throw hiddenMessagesError;
    hiddenMessageIds = new Set((hiddenMessages || []).map(row => row.message_id));
  }
  for (const conversation of conversations) {
    const partnerId = conversation.user_one === currentUser.id ? conversation.user_two : conversation.user_one;
    const person = conversation.is_group ? {id:partnerId,display_name:conversation.group_name||"مجموعة"} : (profileMap.get(partnerId) || { id: partnerId, display_name: "مستخدم مرسال" });
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-button";
    button.dataset.partnerId = partnerId;
    if(!conversation.is_group)appendProfileAvatar(button,person);
    button.append(safeText("span", "conversation-person-name", displayName(person)));
    const latestMessage = latestMessageByConversation.get(conversation.id);
    const unreadCount = unreadCountByConversation.get(conversation.id) || 0;
    let lastMessageText = "لا توجد رسائل بعد";
    if (latestMessage?.is_deleted) {
      lastMessageText = "تم حذف هذه الرسالة";
    } else if (latestMessage && !hiddenMessageIds.has(latestMessage.id)) {
      lastMessageText = String(latestMessage.body || "").trim() || "رسالة غير نصية";
      if (latestMessage.sender_id === currentUser.id) lastMessageText = "أنت: " + lastMessageText;
    } else if (latestMessage) {
      lastMessageText = "آخر رسالة مخفية";
    }
    lastMessageText = lastMessageText.length > 180 ? lastMessageText.slice(0, 180) + "…" : lastMessageText;
    const accessibleConversationLabel = displayName(person) +
      ". آخر رسالة: " + lastMessageText +
      (unreadCount ? ". لديك " + unreadCount + " رسائل غير مقروءة" : ". لا توجد رسائل غير مقروءة");
    button.setAttribute("aria-label", accessibleConversationLabel);
    const isOnline = onlineUserIds.has(partnerId);
    if (isOnline) {
      const presence = safeText("span", "conversation-presence is-online", "متصل الآن");
      button.append(presence);
    }
    button.addEventListener("click", () => { void selectConversation(conversation, person).then(()=>{if(conversation.is_group){chatPartnerName.textContent=conversation.group_name||"مجموعة";chatPartnerPresence.textContent="مجموعة";chatPartnerAccessible.setAttribute("aria-label",chatPartnerName.textContent+", مجموعة");}}); });
    item.append(button);
    conversationList.append(item);
  }
}
async function openConversation(person) {
  if (!currentUser || person.id === currentUser.id) return;
  const [one, two] = [currentUser.id, person.id].sort();
  let { data, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,last_message_at")
    .eq("user_one", one).eq("user_two", two).maybeSingle();
  if (error) {
    announce("تعذر فتح المحادثة: " + error.message, "error");
    return;
  }
  if (!data) {
    const created = await supabase.from("conversations")
      .insert({ user_one: one, user_two: two })
      .select("id,user_one,user_two,last_message_at").single();
    if (created.error && created.error.code !== "23505") {
      announce("تعذر إنشاء المحادثة: " + created.error.message, "error");
      return;
    }
    data = created.data;
    if (!data) {
      const retry = await supabase.from("conversations")
        .select("id,user_one,user_two,last_message_at")
        .eq("user_one", one).eq("user_two", two).single();
      if (retry.error) {
        announce("تعذر استرجاع المحادثة: " + retry.error.message, "error");
        return;
      }
      data = retry.data;
    }
  }
  await selectConversation(data, person);
  await loadConversations();
}
async function selectConversation(conversation, person) {
  if (!groupAddPanel.hidden) { groupAddPanel.hidden=true; document.body.classList.remove("group-add-fullscreen"); }
  const {error:hiddenConversationError}=await supabase.from("conversation_hidden_for").delete().eq("conversation_id",conversation.id).eq("user_id",currentUser.id);
  if(hiddenConversationError)console.warn("Could not unhide conversation:",hiddenConversationError.message);
  status.textContent = "";
  activeConversation = conversation;
  activePartner = person;
  activeGroupMemberCount = null;
  chatPartnerName.textContent = displayName(person);
  chatPartnerAccessible.setAttribute("aria-label", `${chatPartnerName.textContent}، جاري تحديث حالة الظهور`);
  await refreshVisiblePresence().catch(error => console.warn("تعذر تحديث حالة الظهور:", error.message));
  activePartnerLastSeenAt = presenceDetails.get(person.id)?.last_seen_at || null;
  updateChatPartnerPresence();
  if (activeConversation.is_group) void refreshGroupHeaderMemberCount(activeConversation.id);
  chatEmpty.hidden = true;
  chatView.hidden = false;
  workspace.classList.add("chat-open");
  document.body.classList.add("chat-fullscreen");
  bottomNavigation.hidden = true;
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  messageSchedulePanel.hidden = true;
  scheduledMessagesPanel.hidden = true;
  await loadMessages();
  await updateConversationInfo();
  await markConversationNotificationsRead(conversation.id);
  if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel("messages-" + conversation.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: "conversation_id=eq." + conversation.id
    }, async (payload) => {
      const { data: hidden } = await supabase.from("message_hidden_for").select("message_id")
        .eq("message_id", payload.new.id).eq("user_id", currentUser.id).maybeSingle();
      if (!hidden) {
        appendMessage(payload.new);
        if((privacySettings.read_receipts_enabled||conversation.is_group)&&payload.new.sender_id!==currentUser.id){
          void supabase.from("message_reads").upsert({message_id:payload.new.id,user_id:currentUser.id},{onConflict:"message_id,user_id",ignoreDuplicates:true});
        }
      }
    })
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "messages",
      filter: "conversation_id=eq." + conversation.id
    }, () => { void loadMessages(); })
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"message_reads", ...(conversation.is_group ? {} : { filter:"user_id=eq."+(person?.id||"") }) }, async payload => {
      if(!privacySettings.read_receipts_enabled&&!conversation.is_group)return;
      const messageNode=document.querySelector('[data-message-id="'+payload.new.message_id+'"]');
      if(!messageNode || !messageNode.classList.contains("mine"))return;
      if(conversation.is_group){
        const result=await supabase.from("message_reads").select("user_id").eq("message_id",payload.new.message_id);
        if(!result.error){
          const label=messageNode.querySelector(".message-read-state")||safeText("span","message-read-state","");
          label.textContent=(result.data||[]).length ? "مقروء من "+result.data.length : "";
          if(!label.isConnected)messageNode.append(label);
        }
      }else if(!messageNode.querySelector(".message-read-state"))messageNode.append(safeText("span","message-read-state","مقروء"));
    })
    .subscribe((state) => {
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        announce("الاتصال المباشر بالرسائل غير مستقر. استخدم زر تحديث الرسائل للمزامنة.", "error");
      }
    });
  await ensureCallChannel(conversation.id).catch(error => {
    console.warn("Voice call channel:", error);
    announce("تعذر تجهيز المكالمات الصوتية لهذه المحادثة.", "error");
  });
  messageInput.focus();
}

function setConversationInfoValue(element, value) {
  if(!element)return;
  element.textContent = value;
  const group = element.parentElement;
  const label = group?.querySelector(".conversation-info-label")?.textContent?.trim();
  if (group && label) group.setAttribute("aria-label", label + "، " + value);
}

async function loadBlockState(){
  activeBlockState={blockedByMe:false,blockedByThem:false};
  if(!activeConversation||activeConversation.is_group||!activePartner){updateBlockedControls();return;}
  const {data,error}=await supabase.from("user_blocks").select("blocker_id,blocked_id")
    .or("and(blocker_id.eq."+currentUser.id+",blocked_id.eq."+activePartner.id+"),and(blocker_id.eq."+activePartner.id+",blocked_id.eq."+currentUser.id+")");
  if(error)throw error;
  for(const row of data||[]){
    if(row.blocker_id===currentUser.id)activeBlockState.blockedByMe=true;
    if(row.blocker_id===activePartner.id)activeBlockState.blockedByThem=true;
  }
  updateBlockedControls();
}
function isPrivateConversationBlocked(){
  return Boolean(activeConversation&&!activeConversation.is_group&&(activeBlockState.blockedByMe||activeBlockState.blockedByThem));
}
function updateSendButtonVisibility(){
  if(!sendButton)return;
  sendButton.hidden=!messageInput.value.trim();
}
function updateBlockedControls(){
  if(!blockPersonButton)return;
  const blocked=isPrivateConversationBlocked();
  messageInput.disabled=blocked;
  sendButton.disabled=blocked;
  attachButton.disabled=blocked;
  updateSendButtonVisibility();
  if (confirmMessageScheduleButton) confirmMessageScheduleButton.disabled=blocked;
  voiceCallButton.disabled=blocked;
  messageInput.placeholder=blocked?"لا يمكن إرسال الرسائل بسبب الحظر.":"اكتب رسالتك هنا…";
  blockPersonButton.textContent=activeBlockState.blockedByMe?"إلغاء الحظر":activeBlockState.blockedByThem?"هذا الشخص حظرك":"حظر الشخص";
  blockPersonButton.disabled=activeBlockState.blockedByThem&&!activeBlockState.blockedByMe;
  blockPersonButton.setAttribute("aria-label",blockPersonButton.textContent);
}
async function updateConversationInfo() {
  if (!activeConversation || (!activePartner && !activeConversation.is_group)) return;
  const isGroup = Boolean(activeConversation.is_group);
  const { isOwner, isAdmin } = isGroup ? await getCurrentGroupPermissions() : { isOwner: false, isAdmin: false };
  groupAddMembersButton.hidden=!isAdmin;
  blockPersonButton.hidden=isGroup;
  conversationDeleteButton.hidden=false;
  conversationInfoNameLabel.textContent = isGroup ? "اسم المجموعة" : "اسم الشخص";
  conversationInfoStatusRow.hidden = isGroup;
  if(conversationInfoPhotoRow)conversationInfoPhotoRow.hidden=isGroup;
  if(conversationInfoAboutRow)conversationInfoAboutRow.hidden=isGroup;
  setConversationInfoValue(conversationInfoName, isGroup ? (activeConversation.group_name || "مجموعة") : displayName(activePartner));
  if (!isGroup) {
    const visibleProfile=await supabase.rpc("get_visible_profiles",{p_user_ids:[activePartner.id]});
    if(visibleProfile.error)console.warn("تعذر تحميل بيانات الحساب:",visibleProfile.error.message);
    const partnerProfile=await resolveProfileAvatar(visibleProfile.data?.[0]);
    setConversationInfoValue(conversationInfoAbout,partnerProfile?.about||"لا توجد نبذة متاحة.");
    if(conversationInfoPhoto){
      if(partnerProfile?.avatar_url){
        conversationInfoPhoto.src=partnerProfile.avatar_url;
        conversationInfoPhoto.alt="الصورة الشخصية لـ "+displayName(activePartner);
        conversationInfoPhoto.hidden=false;
      }else{
        conversationInfoPhoto.removeAttribute("src");
        conversationInfoPhoto.alt="";
        conversationInfoPhoto.hidden=true;
      }
    }
    const presence = presenceDetails.get(activePartner.id);
    const reciprocalHidden=privacySettingsLoaded&&privacySettings.last_seen_visibility==="nobody";
    setConversationInfoValue(conversationInfoStatus, reciprocalHidden ? "حالة الظهور مخفية" : presence?.is_online ? "متصل الآن" : presence?.last_seen_at ? formatLastSeen(presence.last_seen_at) : "حالة الظهور مخفية");
  }
  const createdAt = activeConversation.created_at;
  setConversationInfoValue(conversationInfoCreated, createdAt ? new Date(createdAt).toLocaleString("ar-JO", { dateStyle: "long", timeStyle: "short" }) : "غير متوفر");
  setConversationInfoValue(conversationInfoCount, "جارٍ التحميل…");
  conversationSearchArea.hidden = true; conversationSearchInput.value = ""; conversationSearchResults.replaceChildren();
  conversationSearchStatus.textContent = "اكتب كلمة لعرض النتائج.";
  groupAdminTools.hidden = !isOwner; groupMemberList.hidden = !isGroup; groupLeaveButton.hidden = !isGroup; groupDeleteEveryoneButton.hidden = !isOwner;
  groupRenameInput.hidden = !isOwner; groupRenameInput.previousElementSibling.hidden = !isOwner; groupRenameSaveButton.hidden = !isOwner;
  groupMemberList.replaceChildren(); groupAddPeople.replaceChildren(); groupAddSearch.value = "";
  if(isGroup){activeBlockState={blockedByMe:false,blockedByThem:false};updateBlockedControls();}
  else await loadBlockState();
  selectedAdditionalMembers.clear(); groupRenameInput.value = activeConversation.group_name || "";
  updateGroupRenameSaveButton();
  const [{count,error},{data:preference,error:preferenceError}] = await Promise.all([
    supabase.from("messages").select("id",{count:"exact",head:true}).eq("conversation_id",activeConversation.id),
    supabase.from("conversation_preferences").select("muted").eq("conversation_id",activeConversation.id).eq("user_id",currentUser.id).maybeSingle()
  ]);
  if(error)setConversationInfoValue(conversationInfoCount,"تعذر تحميل العدد");
  else setConversationInfoValue(conversationInfoCount,new Intl.NumberFormat("ar-JO").format(count||0));
  if(preferenceError){activeConversationMuted=false;announce("تعذر تحميل إعداد الإشعارات لهذه المحادثة.","error");}
  else activeConversationMuted=Boolean(preference?.muted);
  conversationInfoMuteButton.textContent=activeConversationMuted?"تشغيل إشعارات المحادثة":"كتم إشعارات المحادثة";
  if(isGroup)await loadGroupManagement();
}
async function getCurrentGroupPermissions(){
  if(!activeConversation?.is_group||!currentUser)return {isOwner:false,isAdmin:false};
  const isOwner=activeConversation.user_one===currentUser.id;
  if(isOwner)return {isOwner:true,isAdmin:true};
  const {data,error}=await supabase.from("conversation_members").select("role").eq("conversation_id",activeConversation.id).eq("user_id",currentUser.id).maybeSingle();
  if(error){console.warn("تعذر التحقق من صلاحية مشرف المجموعة:",error.message);return {isOwner:false,isAdmin:false};}
  return {isOwner:false,isAdmin:data?.role==="admin"};
}
async function loadGroupManagement(){
  if(!activeConversation?.is_group||!currentUser)return;
  const permissions=await getCurrentGroupPermissions();
  const {data:members,error}=await supabase.from("conversation_members").select("user_id,role").eq("conversation_id",activeConversation.id);
  if(error){announce("تعذر تحميل أعضاء المجموعة: "+error.message,"error");return;}
  // The group creator is a participant even when they do not have a row in conversation_members.
  const displayMembers=[...(members||[])];
  const ownerId=activeConversation.user_one;
  if(ownerId&&!displayMembers.some(member=>member.user_id===ownerId)){
    displayMembers.unshift({user_id:ownerId,role:"owner"});
  }
  activeGroupMemberIds=new Set(displayMembers.map(member=>member.user_id));
  if (activeConversation?.id) {
    activeGroupMemberCount = displayMembers.length;
    updateGroupHeaderAccessibleLabel();
  }
  const ids=[...activeGroupMemberIds];let profiles=[];
  if(ids.length){const result=await supabase.from("profiles").select("id,display_name").in("id",ids);if(result.error){announce("تعذر تحميل أسماء الأعضاء.","error");return;}profiles=result.data||[];}
  const profileMap=new Map(profiles.map(profile=>[profile.id,profile]));groupMemberList.replaceChildren();
  for(const member of displayMembers){
    const isSelf=member.user_id===currentUser.id,isGroupOwner=member.user_id===ownerId;
    const name=profileMap.get(member.user_id)?.display_name||"مستخدم مرسال";
    const roleLabel=isGroupOwner?"منشئ المجموعة":member.role==="admin"?"مشرف":"عضو";
    const item=document.createElement("li");
    const memberButton=safeText("button","group-member-name",name+(isSelf?" (أنت)":""));
    memberButton.type="button";
    memberButton.setAttribute("aria-label","خيارات "+name+(isSelf?"، أنت":""));
    memberButton.addEventListener("click",()=>openGroupMemberOptions(member.user_id,name,roleLabel,member.role,isGroupOwner,permissions,memberButton));
    item.append(memberButton,safeText("span","group-member-role",roleLabel));
    groupMemberList.append(item);
  }
  renderGroupAddPeople();
}
function renderGroupAddPeople(){
  const term=groupAddSearch.value.trim().toLocaleLowerCase();groupAddPeople.replaceChildren();
  const available=people.filter(person=>!activeGroupMemberIds.has(person.id)&&displayName(person).toLocaleLowerCase().includes(term));
  if(!available.length){groupAddPeople.append(safeText("li","empty-item","لا يوجد أشخاص متاحون للإضافة."));return;}
  for(const person of available){
    const item=document.createElement("li"),label=document.createElement("label"),checkbox=document.createElement("input");
    label.className="group-person-choice";checkbox.type="checkbox";checkbox.checked=selectedAdditionalMembers.has(person.id);
    checkbox.addEventListener("change",()=>{if(checkbox.checked)selectedAdditionalMembers.add(person.id);else selectedAdditionalMembers.delete(person.id);});
    label.append(checkbox,document.createTextNode(displayName(person)));item.append(label);groupAddPeople.append(item);
  }
}
function openGroupMemberOptions(userId,name,roleLabel,role,isGroupOwner,permissions,returnFocus){
  groupMemberOptionsReturnFocus=returnFocus;
  groupMemberOptionsName.textContent=name;
  groupMemberOptionsRole.textContent=roleLabel;
  groupMemberOptionsActions.replaceChildren();
  const isSelf=userId===currentUser?.id;
  if(!isSelf){
    const messageButton=safeText("button","primary-button group-member-action","مراسلة");
    messageButton.type="button";
    messageButton.addEventListener("click",()=>{
      closeGroupMemberOptions();
      void openConversation({id:userId,display_name:name});
    });
    groupMemberOptionsActions.append(messageButton);
  }
  if(!isSelf&&!isGroupOwner){
    if(permissions.isOwner){
      const roleButton=safeText("button","quiet-button group-member-action",role==="admin"?"إزالة صفة المشرف":"تعيين مشرف");
      roleButton.type="button";
      roleButton.addEventListener("click",()=>{void manageGroupMember(userId,name,role==="admin"?"demote":"promote");});
      groupMemberOptionsActions.append(roleButton);
    }
    if(permissions.isOwner||role!=="admin"){
      const remove=safeText("button","danger-button group-member-remove","إزالة من المجموعة");
      remove.type="button";
      remove.addEventListener("click",()=>{void manageGroupMember(userId,name,"remove");});
      groupMemberOptionsActions.append(remove);
    }
  }
  if(!groupMemberOptionsActions.childElementCount){
    groupMemberOptionsActions.append(safeText("p","group-member-no-actions","لا توجد إجراءات متاحة لهذا العضو."));
  }
  groupMemberOptionsPanel.hidden=false;
  document.body.classList.add("group-member-options-fullscreen");
  closeGroupMemberOptionsButton.focus();
}
function closeGroupMemberOptions(){
  groupMemberOptionsPanel.hidden=true;
  document.body.classList.remove("group-member-options-fullscreen");
  if(groupMemberOptionsReturnFocus?.isConnected)groupMemberOptionsReturnFocus.focus();
}
closeGroupMemberOptionsButton.addEventListener("click",closeGroupMemberOptions);
groupMemberOptionsPanel.addEventListener("keydown",event=>{if(event.key==="Escape")closeGroupMemberOptions();});
async function manageGroupMember(userId,name,action){
  if(!activeConversation?.is_group||!currentUser)return;
  const prompts={promote:"هل تريد تعيين "+name+" مشرفًا في المجموعة؟",demote:"هل تريد إزالة صفة المشرف عن "+name+"؟",remove:"هل تريد إزالة "+name+" من المجموعة؟"};
  if(!window.confirm(prompts[action]||"تأكيد الإجراء؟"))return;
  const {error}=await supabase.rpc("manage_group_member",{p_conversation_id:activeConversation.id,p_target_user_id:userId,p_action:action});
  if(error){announce("تعذر تنفيذ الإجراء: "+(error.message||"حاول مرة أخرى."),"error");return;}
  closeGroupMemberOptions();
  await loadGroupManagement();await loadConversations();
  announce(action==="promote"?"تم تعيينه مشرفًا.":action==="demote"?"تمت إزالة صفة المشرف.":"تمت إزالة العضو.");
}
groupAddSearch.addEventListener("input",renderGroupAddPeople);
groupAddMembersButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||!(await getCurrentGroupPermissions()).isAdmin)return;
  conversationInfoPanel.hidden=true;
  document.body.classList.remove("conversation-info-fullscreen");
  groupAddPanel.hidden=false;
  document.body.classList.add("group-add-fullscreen");
  renderGroupAddPeople();
  groupAddSearch.focus();
});
function closeGroupAddPanel(){
  groupAddPanel.hidden=true;
  document.body.classList.remove("group-add-fullscreen");
  groupAddMembersButton.focus();
}
closeGroupAddButton.addEventListener("click",closeGroupAddPanel);
groupAddPanel.addEventListener("keydown",event=>{if(event.key==="Escape")closeGroupAddPanel();});
groupAddSelectedButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||!(await getCurrentGroupPermissions()).isAdmin)return;
  const ids=[...selectedAdditionalMembers].filter(id=>!activeGroupMemberIds.has(id));
  if(!ids.length){announce("اختر شخصًا واحدًا على الأقل.","error");return;}
  groupAddSelectedButton.disabled=true;
  try{const rows=ids.map(user_id=>({conversation_id:activeConversation.id,user_id,role:"member"}));const {error}=await supabase.from("conversation_members").insert(rows);if(error)throw error;selectedAdditionalMembers.clear();await loadGroupManagement();await loadConversations();closeGroupAddPanel();announce("تمت إضافة الأعضاء.");}
  catch(error){announce("تعذرت إضافة الأعضاء: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{groupAddSelectedButton.disabled=false;}
});
let groupRenameSaveInProgress = false;
function updateGroupRenameSaveButton() {
  if (!groupRenameSaveButton) return;
  const original = String(activeConversation?.group_name || "").trim();
  const current = groupRenameInput.value.trim();
  groupRenameSaveButton.disabled = groupRenameSaveInProgress || !activeConversation?.is_group || current.length < 2 || current === original;
}
groupRenameInput.addEventListener("input", updateGroupRenameSaveButton);
groupRenameSaveButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||activeConversation.user_one!==currentUser.id)return;
  const name=groupRenameInput.value.trim();
  if(name.length<2){announce("اسم المجموعة يجب أن يتكون من حرفين على الأقل.","error");groupRenameInput.focus();return;}
  if (name === String(activeConversation.group_name || "").trim() || groupRenameSaveInProgress) return;
  groupRenameSaveInProgress = true;
  updateGroupRenameSaveButton();
  try{const {data,error}=await supabase.from("conversations").update({group_name:name}).eq("id",activeConversation.id).eq("user_one",currentUser.id).select("id").maybeSingle();if(error||!data)throw error||new Error("لا تملك صلاحية تغيير الاسم.");activeConversation.group_name=name;chatPartnerName.textContent=name;updateGroupHeaderAccessibleLabel();await loadConversations();await updateConversationInfo();announce("تم تغيير اسم المجموعة.");}
  catch(error){announce("تعذر تغيير اسم المجموعة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{groupRenameSaveInProgress=false;updateGroupRenameSaveButton();}
});
async function deleteActiveGroup(deleteForEveryone){
  if(!activeConversation?.is_group||!currentUser)return;
  if(deleteForEveryone&&activeConversation.user_one!==currentUser.id)return;
  const confirmation=deleteForEveryone
    ?"سيتم حذف المجموعة نهائيًا من عند جميع الأعضاء، بما في ذلك الرسائل والملفات. لا يمكن التراجع. هل تريد المتابعة؟"
    :"سيتم حذف المجموعة من قائمتك وإزالتك منها فقط. ستبقى المجموعة وباقي الرسائل متاحة للأعضاء الآخرين. هل تريد المتابعة؟";
  if(!window.confirm(confirmation))return;
  const button=deleteForEveryone?groupDeleteEveryoneButton:groupLeaveButton;
  button.disabled=true;
  try{
    const id=activeConversation.id;
    const result=await supabase.rpc("delete_group",{p_conversation_id:id,p_delete_for_everyone:deleteForEveryone});
    if(result.error)throw result.error;
    if(activeCall)await endVoiceCall(true);
    if(realtimeChannel){await supabase.removeChannel(realtimeChannel);realtimeChannel=null;}
    await closeCallChannel(id);
    conversationInfoPanel.hidden=true;
    document.body.classList.remove("conversation-info-fullscreen","chat-fullscreen");
    workspace.classList.remove("chat-open");
    chatView.hidden=true;chatEmpty.hidden=false;
    activeConversation=null;activePartner=null;
    await loadConversations();
    announce(deleteForEveryone?"تم حذف المجموعة للجميع.":"تم حذف المجموعة من عندك.");
  }catch(error){
    announce("تعذر حذف المجموعة: "+(error.message||"حاول مرة أخرى."),"error");
  }finally{button.disabled=false;}
}
groupLeaveButton.addEventListener("click",()=>{deleteActiveGroup(false);});
groupDeleteEveryoneButton.addEventListener("click",()=>{deleteActiveGroup(true);});

blockPersonButton.addEventListener("click",async()=>{
  if(!activeConversation||activeConversation.is_group||!activePartner||!currentUser||activeBlockState.blockedByThem&&!activeBlockState.blockedByMe)return;
  if(!activeBlockState.blockedByMe&&!window.confirm("لن يتمكن هذا الشخص من مراسلتك أو الاتصال بك عبر مرسال. هل تريد حظره؟"))return;
  blockPersonButton.disabled=true;
  try{
    if(activeBlockState.blockedByMe){
      const {error}=await supabase.from("user_blocks").delete().eq("blocker_id",currentUser.id).eq("blocked_id",activePartner.id);
      if(error)throw error;
    }else{
      const {error}=await supabase.from("user_blocks").insert({blocker_id:currentUser.id,blocked_id:activePartner.id});
      if(error&&error.code!=="23505")throw error;
    }
    await loadBlockState();
    if(isPrivateConversationBlocked()&&activeCall){await endVoiceCall(true);updateBlockedControls();}
    announce(activeBlockState.blockedByMe?"تم حظر الشخص.":"تم إلغاء الحظر.");
  }catch(error){announce("تعذر تغيير الحظر: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{blockPersonButton.disabled=activeBlockState.blockedByThem&&!activeBlockState.blockedByMe;}
});

conversationDeleteButton.addEventListener("click",async()=>{
  if(!activeConversation||!currentUser)return;
  const id=activeConversation.id,isGroup=Boolean(activeConversation.is_group);
  const label=isGroup?"المجموعة":"الدردشة";
  if(!window.confirm("سيتم حذف "+label+" من قائمتك فقط. لن تُحذف لدى بقية المشاركين، وستظهر مجددًا عند وصول رسالة جديدة. هل تريد المتابعة؟"))return;
  conversationDeleteButton.disabled=true;
  try{
    const {error}=await supabase.from("conversation_hidden_for").insert({conversation_id:id,user_id:currentUser.id});
    if(error&&error.code!=="23505")throw error;
    if(activeCall)await endVoiceCall(true);
    if(realtimeChannel){await supabase.removeChannel(realtimeChannel);realtimeChannel=null;}
    await closeCallChannel(id);
    conversationInfoPanel.hidden=true;
    groupAddPanel.hidden=true;
    document.body.classList.remove("conversation-info-fullscreen","group-add-fullscreen","chat-fullscreen");
    workspace.classList.remove("chat-open");
    chatView.hidden=true;chatEmpty.hidden=false;
    activeConversation=null;activePartner=null;
    activeBlockState={blockedByMe:false,blockedByThem:false};
    await loadConversations();
    announce("تم حذف الدردشة من قائمتك.");
  }catch(error){announce("تعذر حذف الدردشة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{conversationDeleteButton.disabled=false;}
});

conversationInfoMuteButton.addEventListener("click",async()=>{
  if(!activeConversation||!currentUser)return;
  conversationInfoMuteButton.disabled=true;const muted=!activeConversationMuted;
  try{const {error}=await supabase.from("conversation_preferences").upsert({conversation_id:activeConversation.id,user_id:currentUser.id,muted,updated_at:new Date().toISOString()},{onConflict:"conversation_id,user_id"});if(error)throw error;activeConversationMuted=muted;conversationInfoMuteButton.textContent=muted?"تشغيل إشعارات المحادثة":"كتم إشعارات المحادثة";announce(muted?"تم كتم إشعارات المحادثة.":"تم تشغيل إشعارات المحادثة.");}
  catch(error){announce("تعذر تغيير الإشعارات: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{conversationInfoMuteButton.disabled=false;}
});
conversationInfoClearButton.addEventListener("click",async()=>{
  if(!activeConversation||!currentUser)return;
  if(!window.confirm("سيتم إخفاء رسائل هذه المحادثة من جهازك فقط، ولن تُحذف عند الطرف الآخر. هل تريد المتابعة؟"))return;
  conversationInfoClearButton.disabled=true;
  try{
    const id=activeConversation.id;let all=[];
    for(let offset=0;;offset+=500){const {data,error}=await supabase.from("messages").select("id").eq("conversation_id",id).order("created_at",{ascending:true}).range(offset,offset+499);if(error)throw error;all=all.concat(data||[]);if(!data||data.length<500)break;}
    const {data:hidden,error:hiddenError}=await supabase.from("message_hidden_for").select("message_id").eq("user_id",currentUser.id);if(hiddenError)throw hiddenError;
    const hiddenIds=new Set((hidden||[]).map(row=>row.message_id)),rows=all.filter(message=>!hiddenIds.has(message.id)).map(message=>({message_id:message.id,user_id:currentUser.id}));
    for(let i=0;i<rows.length;i+=100){const {error}=await supabase.from("message_hidden_for").insert(rows.slice(i,i+100));if(error)throw error;}
    await loadMessages();conversationInfoPanel.hidden=true;document.body.classList.remove("conversation-info-fullscreen");announce("تم مسح المحادثة من جهازك.");
  }catch(error){announce("تعذر مسح المحادثة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{conversationInfoClearButton.disabled=false;}
});
conversationSearchInput.addEventListener("input", () => {
  const term = conversationSearchInput.value.trim().toLocaleLowerCase();
  conversationSearchResults.replaceChildren();
  if (!term) {
    conversationSearchArea.hidden = true;
    conversationSearchStatus.textContent = "اكتب كلمة لعرض النتائج.";
    return;
  }
  conversationSearchArea.hidden = false;
  const matches = [...messagesList.querySelectorAll(".message")].filter(item => {
    const text = [...item.querySelectorAll(".message-body, .attachment-file-name")]
      .map(node => node.textContent || "").join(" ").toLocaleLowerCase();
    return text.includes(term);
  });
  conversationSearchStatus.textContent = matches.length
    ? "عدد النتائج: " + new Intl.NumberFormat("ar-JO").format(matches.length)
    : "لا توجد نتائج ضمن الرسائل المحمّلة حاليًا.";
  for (const item of matches) {
    const messageText = [...item.querySelectorAll(".message-body, .attachment-file-name")]
      .map(node => node.textContent || "").join(" ").trim() || "مرفق";
    const time = item.querySelector(".message-time")?.textContent || "";
    const result = document.createElement("li");
    const button = safeText("button", "conversation-search-result", messageText.slice(0, 180) + (time ? "، " + time : ""));
    button.type = "button";
    button.addEventListener("click", () => {
      conversationInfoPanel.hidden = true;
      document.body.classList.remove("conversation-info-fullscreen");
      item.tabIndex = -1;
      item.scrollIntoView({ behavior: "smooth", block: "center" });
      item.focus();
    });
    result.append(button);
    conversationSearchResults.append(result);
  }
});
conversationInfoExportButton.addEventListener("click", async () => {
  if (!activeConversation || !currentUser) return;
  conversationInfoExportButton.disabled = true;
  try {
    const { data, error } = await supabase.from("messages")
      .select("id,sender_id,body,created_at,is_deleted")
      .eq("conversation_id", activeConversation.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const rows = data || [];
    const { data: hiddenRows, error: hiddenError } = await supabase.from("message_hidden_for")
      .select("message_id").eq("user_id", currentUser.id);
    if (hiddenError) throw hiddenError;
    const hiddenIds = new Set((hiddenRows || []).map(row => row.message_id));
    const visible = rows.filter(row => !hiddenIds.has(row.id));
    const senderIds = [...new Set(visible.map(row => row.sender_id).filter(Boolean))];
    let names = new Map();
    if (senderIds.length) {
      const { data: profiles, error: profileError } = await supabase.from("profiles")
        .select("id,display_name").in("id", senderIds);
      if (profileError) throw profileError;
      names = new Map((profiles || []).map(profile => [profile.id, profile.display_name || "مستخدم مرسال"]));
    }
    const title = activeConversation.is_group
      ? (activeConversation.group_name || "مجموعة")
      : displayName(activePartner);
    const lines = ["مرسال - " + title, "آخر " + visible.length + " رسالة", ""];
    for (const message of visible) {
      const date = new Date(message.created_at).toLocaleString("ar-JO");
      let body = message.is_deleted ? "تم حذف هذه الرسالة." : (message.body || "");
      const marker = "MERSAL_ATTACHMENT:";
      const markerIndex = body.indexOf(marker);
      if (markerIndex >= 0) {
        try {
          const attachment = JSON.parse(body.slice(markerIndex + marker.length));
          body = "[مرفق: " + (attachment.name || "ملف") + "]";
        } catch { body = "[مرفق]"; }
      }
      const sender = message.sender_id === currentUser.id ? "أنت" : (names.get(message.sender_id) || "مستخدم مرسال");
      lines.push(date + " — " + sender + ": " + body);
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mersal-conversation-" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    announce("تم تجهيز سجل المحادثة.");
  } catch (error) {
    announce("تعذر تجهيز سجل المحادثة: " + (error.message || "حاول مرة أخرى."), "error");
  } finally {
    conversationInfoExportButton.disabled = false;
  }
});
backToChatsButton.addEventListener("click", async () => {
  setActiveBottomTab("home");
  if (activeCall) await endVoiceCall(true);
  await closeCallChannel();
  document.body.classList.remove("chat-fullscreen");
  workspace.classList.remove("chat-open");
  bottomNavigation.hidden = false;
  chatView.hidden = true;
  chatEmpty.hidden = false;
  conversationInfoPanel.hidden = true;
  messageSchedulePanel.hidden = true;
  scheduledMessagesPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  peopleSearch.focus();
});
chatPartnerAccessible.addEventListener("click", async () => {
  if (!activeConversation) return;
  if (status.textContent) status.textContent = "";
  conversationInfoPanel.hidden = false;
  document.body.classList.add("conversation-info-fullscreen");
  await updateConversationInfo();
  closeConversationInfoButton.focus();
});
closeConversationInfoButton.addEventListener("click", () => {
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  chatPartnerAccessible.focus();
});


function updateVoiceCallPanel() {
  if (!activeCall) { voiceCallPanel.hidden = true; return; }
  voiceCallPanel.hidden = false;
  voiceCallAcceptButton.hidden = activeCall.accepted || !activeCall.incoming;
  voiceCallRejectButton.hidden = activeCall.accepted || !activeCall.incoming;
  voiceCallMuteButton.hidden = !activeCall.accepted;
  voiceCallEndButton.hidden = !activeCall.accepted;
  voiceCallMuteButton.textContent = activeCall.muted ? "تشغيل الميكروفون" : "كتم الميكروفون";
  const callConversation=conversations.find(item=>item.id===activeCall.conversationId);
  voiceCallEndButton.textContent = activeCall.isGroup && activeCall.initiatorId !== currentUser.id ? "مغادرة المكالمة" : "إنهاء المكالمة";
  voiceCallParticipants.replaceChildren();
  for (const id of activeCall.participants) {
    const profile = people.find(person => person.id === id);
    const name = id === currentUser.id ? "أنت" : (profile ? displayName(profile) : "مشارك في المكالمة");
    voiceCallParticipants.append(safeText("li", "voice-call-participant", name));
  }
}
function setVoiceCallStatus(message) {
  voiceCallStatus.textContent = message;
}
async function ensureCallChannel(conversationId) {
  const existing=callChannels.get(conversationId);
  if(existing?.ready)return;
  if(existing?.promise)return existing.promise;
  if(existing?.channel){callChannels.delete(conversationId);await supabase.removeChannel(existing.channel);}
  await supabase.realtime.setAuth();
  const channel=supabase.channel("mersal-call:"+conversationId,{config:{private:true}});
  const entry={channel,ready:false,promise:null};
  callChannels.set(conversationId,entry);
  entry.promise=new Promise((resolve,reject)=>{
    let settled=false;
    channel.on("broadcast",{event:"call-signal"},message=>{
      void handleCallSignal(message?.payload||message).catch(error=>{
        console.warn("Voice call signal:",error);
        if(activeCall?.conversationId===conversationId)setVoiceCallStatus("حدثت مشكلة في الاتصال الصوتي.");
      });
    });
    channel.subscribe(state=>{
      if(state==="SUBSCRIBED"){
        entry.ready=true;
        if(!settled){settled=true;resolve();}
      }else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT"||state==="CLOSED"){
        entry.ready=false;entry.promise=null;
        if(!settled){settled=true;reject(new Error("تعذر الاتصال بقناة المكالمة."));}
        else console.warn("Voice call channel disconnected:",conversationId,state);
      }
    });
  });
  try{await entry.promise;}
  catch(error){
    if(callChannels.get(conversationId)===entry)callChannels.delete(conversationId);
    await supabase.removeChannel(channel);throw error;
  }
}
async function syncCallChannels(){
  if(!currentUser)return;
  const required=new Set(conversations.map(item=>item.id));
  if(activeCall?.conversationId)required.add(activeCall.conversationId);
  const stale=[...callChannels.keys()].filter(id=>!required.has(id));
  await Promise.all(stale.map(id=>closeCallChannel(id)));
  await Promise.all([...required].map(id=>ensureCallChannel(id).catch(error=>console.warn("تعذر تجهيز قناة المكالمة:",id,error.message))));
}
async function closeCallChannel(conversationId=null){
  const entries=conversationId?[callChannels.get(conversationId)].filter(Boolean):[...callChannels.values()];
  if(conversationId)callChannels.delete(conversationId);else callChannels.clear();
  await Promise.all(entries.map(entry=>supabase.removeChannel(entry.channel)));
}
async function sendCallSignal(type,to,details={},callId=activeCall?.id,conversationId=activeCall?.conversationId){
  if(!to||!callId||!conversationId)throw new Error("بيانات المكالمة غير مكتملة.");
  let entry=callChannels.get(conversationId);
  if(!entry?.ready){await ensureCallChannel(conversationId);entry=callChannels.get(conversationId);}
  if(!entry?.ready)throw new Error("قناة المكالمة غير جاهزة.");
  const result=await entry.channel.send({type:"broadcast",event:"call-signal",payload:{type,callId,conversationId,from:currentUser.id,to,details}});
  if(result!=="ok")throw new Error("تعذر إرسال إشارة المكالمة.");
}
async function sendCallSignalToAll(type, details = {}) {
  if (!activeCall) return;
  const targets = [...activeCall.participants].filter(id => id !== currentUser.id);
  await Promise.all(targets.map(id => sendCallSignal(type, id, details)));
}
async function getVoiceCallParticipantIds(conversation=activeConversation) {
  if(!conversation||!currentUser)return [];
  if(!conversation.is_group){
    const partnerId=conversation.user_one===currentUser.id?conversation.user_two:conversation.user_one;
    return [partnerId].filter(id=>id&&id!==currentUser.id);
  }
  const {data,error}=await supabase.from("conversation_members").select("user_id").eq("conversation_id",conversation.id);
  if(error)throw error;
  return [...new Set([conversation.user_one,...(data||[]).map(row=>row.user_id)].filter(id=>id&&id!==currentUser.id))];
}
async function startVoiceCall() {
  if (!activeConversation || !currentUser || activeCall) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    announce("المكالمات الصوتية تحتاج متصفحًا آمنًا يدعم الميكروفون.", "error"); return;
  }
  voiceCallButton.disabled = true;
  try {
    await ensureCallChannel(activeConversation.id);
    const participants = await getVoiceCallParticipantIds();
    if (!participants.length) throw new Error("لا يوجد مشاركون متاحون في هذه المحادثة.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    const participantSet = new Set([currentUser.id, ...participants]);
    activeCall = {
      id: crypto.randomUUID(), conversationId: activeConversation.id, isGroup: Boolean(activeConversation.is_group),
      initiatorId: currentUser.id, participants: participantSet, accepted: true,
      incoming: false, muted: false, localStream: stream, peers: new Map(),
      readyUsers: new Set([currentUser.id]), pendingOffers: new Map(), pendingIce: new Map()
    };
    updateVoiceCallPanel();
    voiceCallEndButton.focus();
    setVoiceCallStatus("جارٍ الاتصال بالمشاركين…");
    await Promise.all(participants.map(id => sendCallSignal("invite", id, {
      participants: [...participantSet], initiatorId: currentUser.id
    })));
    await sendCallSignalToAll("ready");
  } catch (error) {
    if (activeCall) await endVoiceCall(true);
    else await finishVoiceCall();
    announce("تعذر بدء المكالمة: " + (error.message || "تحقق من إذن الميكروفون."), "error");
  } finally {
    voiceCallButton.disabled = false;
  }
}
function createVoicePeer(peerId) {
  if (!activeCall || activeCall.peers.has(peerId)) return activeCall?.peers.get(peerId) || null;
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  });
  activeCall.peers.set(peerId, pc);
  for (const track of activeCall.localStream.getAudioTracks()) pc.addTrack(track, activeCall.localStream);
  pc.onicecandidate = event => {
    if (event.candidate && activeCall?.peers.get(peerId) === pc) {
      void sendCallSignal("ice", peerId, { candidate: event.candidate.toJSON() }).catch(error => console.warn(error));
    }
  };
  pc.ontrack = event => {
    if (activeCall?.peers.get(peerId) !== pc) return;
    let audio = voiceCallAudio.querySelector('[data-peer-id="' + peerId + '"]');
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true; audio.playsInline = true;
      audio.dataset.peerId = peerId;
      voiceCallAudio.append(audio);
    }
    audio.srcObject = event.streams[0];
    void audio.play().then(() => {
      if (voiceCallEnableAudioButton) voiceCallEnableAudioButton.hidden = true;
    }).catch(() => {
      if (voiceCallEnableAudioButton) voiceCallEnableAudioButton.hidden = false;
      setVoiceCallStatus("تم الاتصال. اضغط تشغيل صوت المكالمة لسماع الطرف الآخر.");
    });
  };
  pc.onconnectionstatechange = () => {
    if (activeCall?.peers.get(peerId) !== pc) return;
    const states = [...activeCall.peers.values()].map(peer => peer.connectionState);
    if (states.includes("connected")) setVoiceCallStatus("المكالمة الصوتية متصلة.");
    else if (states.some(state => state === "failed" || state === "disconnected")) {
      setVoiceCallStatus("الاتصال بأحد المشاركين غير مستقر. تحقق من الشبكة.");
    }
  };
  return pc;
}
async function flushVoiceIce(peerId, pc) {
  const pending = activeCall?.pendingIce.get(peerId) || [];
  if (!activeCall) return;
  activeCall.pendingIce.delete(peerId);
  for (const candidate of pending) {
    try { await pc.addIceCandidate(candidate); } catch (error) { console.warn("ICE candidate:", error); }
  }
}
async function maybeCreateVoiceOffer(peerId) {
  if (!activeCall?.accepted || !activeCall.readyUsers.has(peerId) || currentUser.id.localeCompare(peerId) >= 0) return;
  if (activeCall.peers.has(peerId)) return;
  const pc = createVoicePeer(peerId);
  if (!pc) return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendCallSignal("offer", peerId, { description: pc.localDescription.toJSON() });
}
async function handleVoiceOffer(from, description) {
  if (!activeCall?.accepted) { activeCall?.pendingOffers.set(from, description); return; }
  const pc = createVoicePeer(from);
  if (!pc || pc.remoteDescription) return;
  await pc.setRemoteDescription(description);
  await flushVoiceIce(from, pc);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await sendCallSignal("answer", from, { description: pc.localDescription.toJSON() });
}
async function handleCallSignal(signal) {
  if(!signal||!currentUser||signal.to!==currentUser.id||signal.from===currentUser.id||!signal.conversationId)return;
  const from=signal.from,details=signal.details||{};
  if(signal.type==="invite"){
    const callConversation=conversations.find(item=>item.id===signal.conversationId);
    if(!callConversation)return;
    if(!callConversation.is_group){
      const otherId=callConversation.user_one===currentUser.id?callConversation.user_two:callConversation.user_one;
      const [blockedByMe,blockedByThem]=await Promise.all([
        supabase.from("user_blocks").select("blocker_id").eq("blocker_id",currentUser.id).eq("blocked_id",otherId).maybeSingle(),
        supabase.from("user_blocks").select("blocker_id").eq("blocker_id",otherId).eq("blocked_id",currentUser.id).maybeSingle()
      ]);
      if(blockedByMe.error||blockedByThem.error)throw blockedByMe.error||blockedByThem.error;
      if(blockedByMe.data||blockedByThem.data)return;
    }
    const validParticipants=await getVoiceCallParticipantIds(callConversation);
    if(!validParticipants.includes(from))return;
    if (activeCall) {
      if (activeCall.id !== signal.callId) {
        try { await sendCallSignal("busy", from, {}, signal.callId, signal.conversationId); } catch {}
      }
      return;
    }
    activeCall = {
      id: signal.callId, conversationId: signal.conversationId, isGroup: Boolean(callConversation.is_group),
      initiatorId: from,
      participants: new Set([currentUser.id,...validParticipants]),
      accepted: false, incoming: true, muted: false, localStream: null,
      peers: new Map(), readyUsers: new Set([from]),
      pendingOffers: new Map(), pendingIce: new Map()
    };
    updateVoiceCallPanel();
    setVoiceCallStatus((people.find(person => person.id === from) ? displayName(people.find(person => person.id === from)) : "أحد المشاركين") + " يتصل بك صوتيًا.");
    voiceCallAcceptButton.focus();
    return;
  }
  if (!activeCall || activeCall.id !== signal.callId || activeCall.conversationId !== signal.conversationId || !activeCall.participants.has(from)) return;
  if (signal.type === "ready") {
    activeCall.readyUsers.add(from);
    if (activeCall.accepted) await maybeCreateVoiceOffer(from);
  } else if (signal.type === "offer") {
    if (!activeCall.accepted) activeCall.pendingOffers.set(from, details.description);
    else await handleVoiceOffer(from, details.description);
  } else if (signal.type === "answer") {
    const pc = activeCall.peers.get(from);
    if (pc && !pc.remoteDescription) {
      await pc.setRemoteDescription(details.description);
      await flushVoiceIce(from, pc);
    }
  } else if (signal.type === "ice") {
    const pc = activeCall.peers.get(from);
    if (pc?.remoteDescription) {
      try { await pc.addIceCandidate(details.candidate); } catch (error) { console.warn("ICE candidate:", error); }
    } else {
      const queue = activeCall.pendingIce.get(from) || [];
      queue.push(details.candidate); activeCall.pendingIce.set(from, queue);
    }
  } else if (signal.type === "decline") {
    setVoiceCallStatus("رفض أحد المشاركين المكالمة.");
    if (!activeConversation?.is_group) await finishVoiceCall();
  } else if (signal.type === "busy") {
    setVoiceCallStatus("أحد المشاركين مشغول حاليًا.");
  } else if (signal.type === "leave") {
    const pc = activeCall.peers.get(from); if (pc) pc.close();
    activeCall.peers.delete(from); activeCall.participants.delete(from); activeCall.readyUsers.delete(from);
    voiceCallAudio.querySelector('[data-peer-id="' + from + '"]')?.remove();
    updateVoiceCallPanel();
    if (activeCall.participants.size <= 1) await finishVoiceCall();
  } else if (signal.type === "end") {
    await finishVoiceCall();
  }
}
async function acceptVoiceCall() {
  if (!activeCall?.incoming || activeCall.accepted) return;
  voiceCallAcceptButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    activeCall.localStream = stream;
    activeCall.accepted = true;
    activeCall.readyUsers.add(currentUser.id);
    updateVoiceCallPanel();
    voiceCallMuteButton.focus();
    setVoiceCallStatus("تم الانضمام. جارٍ توصيل الصوت…");
    await sendCallSignalToAll("ready");
    for (const [peerId, description] of [...activeCall.pendingOffers]) {
      activeCall.pendingOffers.delete(peerId);
      await handleVoiceOffer(peerId, description);
    }
    for (const peerId of activeCall.readyUsers) await maybeCreateVoiceOffer(peerId);
  } catch (error) {
    announce("تعذر الرد على المكالمة: " + (error.message || "تحقق من إذن الميكروفون."), "error");
    await rejectVoiceCall();
  } finally {
    voiceCallAcceptButton.disabled = false;
  }
}
async function rejectVoiceCall() {
  if (!activeCall) return;
  const caller = activeCall.initiatorId;
  try { await sendCallSignal("decline", caller); } catch {}
  await finishVoiceCall();
}
function toggleVoiceCallMute() {
  if (!activeCall?.localStream) return;
  activeCall.muted = !activeCall.muted;
  for (const track of activeCall.localStream.getAudioTracks()) track.enabled = !activeCall.muted;
  updateVoiceCallPanel();
  setVoiceCallStatus(activeCall.muted ? "الميكروفون مكتوم." : "الميكروفون يعمل.");
}
async function endVoiceCall(notifyOthers = true) {
  if (!activeCall) { voiceCallPanel.hidden = true; return; }
  if (notifyOthers) {
    const wasAccepted = activeCall.accepted;
    const caller = activeCall.initiatorId;
    const shouldEndForEveryone = !activeCall.isGroup || caller === currentUser?.id;
    try {
      if (wasAccepted && shouldEndForEveryone) await sendCallSignalToAll("end");
      else if (wasAccepted) await sendCallSignalToAll("leave");
      else await sendCallSignal("decline", caller);
    } catch (error) { console.warn("End call signal:", error); }
  }
  await finishVoiceCall();
}
async function finishVoiceCall() {
  const call = activeCall;
  activeCall = null;
  if (call?.peers) for (const pc of call.peers.values()) pc.close();
  if (call?.localStream) for (const track of call.localStream.getTracks()) track.stop();
  voiceCallAudio.replaceChildren();
  if (voiceCallEnableAudioButton) voiceCallEnableAudioButton.hidden = true;
  voiceCallPanel.hidden = true;
  if (voiceCallButton?.isConnected && !chatView.hidden) voiceCallButton.focus();
}
voiceCallButton.addEventListener("click", () => { void startVoiceCall(); });
voiceCallAcceptButton.addEventListener("click", () => { void acceptVoiceCall(); });
voiceCallRejectButton.addEventListener("click", () => { void rejectVoiceCall(); });
voiceCallMuteButton.addEventListener("click", toggleVoiceCallMute);
voiceCallEndButton.addEventListener("click", () => { void endVoiceCall(); });
voiceCallEnableAudioButton?.addEventListener("click", async () => {
  voiceCallEnableAudioButton.disabled = true;
  try {
    const players = [...voiceCallAudio.querySelectorAll("audio")];
    if (!players.length) throw new Error("لم يصل الصوت من الطرف الآخر بعد.");
    await Promise.all(players.map(async audio => {
      audio.muted = false;
      audio.volume = 1;
      await audio.play();
    }));
    voiceCallEnableAudioButton.hidden = true;
    setVoiceCallStatus("تم تشغيل صوت المكالمة.");
  } catch (error) {
    setVoiceCallStatus(error.message || "تعذر تشغيل الصوت. تحقق من مستوى صوت الهاتف.");
  } finally {
    voiceCallEnableAudioButton.disabled = false;
  }
});
voiceCallPanel.addEventListener("keydown", event => {
  if (event.key === "Escape" && activeCall) { event.preventDefault(); void endVoiceCall(); }
});

function closeMessageOptions(menu, toggle) {
  menu.classList.remove("is-open");
  menu.hidden = true;
  menu.removeAttribute("role");
  menu.removeAttribute("aria-modal");
  if (menu._home && menu.parentElement !== menu._home) menu._home.append(menu);
  toggle.setAttribute("aria-expanded", "false");
  toggle.focus();
}
async function deleteMessageForMe(message, item, menu, toggle) {
  if (!currentUser || !activeConversation) return;
  if (localStorage.getItem("mersal-chat-confirm-delete") !== "false" && !window.confirm("هل تريد حذف هذه الرسالة من محادثتك فقط؟")) return;
  const { error } = await supabase.from("message_hidden_for").insert({
    message_id: message.id, user_id: currentUser.id
  });
  if (error && error.code !== "23505") {
    announce("تعذر حذف الرسالة لديك: " + error.message, "error");
    return;
  }
  item.remove();
  closeMessageOptions(menu, toggle);
  if (!messagesList.querySelector(".message")) messagesList.append(safeText("li", "empty-item", "هذه بداية المحادثة. أرسل أول رسالة."));
  announce("تم الحذف.", "success");
}
async function deleteMessageForEveryone(message, item, menu, toggle) {
  if (!currentUser || message.sender_id !== currentUser.id) {
    announce("يمكنك حذف رسائلك أنت لدى الجميع فقط.", "error");
    return;
  }
  if (localStorage.getItem("mersal-chat-confirm-delete") !== "false" && !window.confirm("سيتم حذف محتوى الرسالة من محادثتك ومحادثة الطرف الآخر. هل تريد المتابعة؟")) return;
  const { data, error } = await supabase.from("messages")
    .update({ is_deleted: true }).eq("id", message.id).eq("sender_id", currentUser.id)
    .select("id").maybeSingle();
  if (error || !data) {
    announce("تعذر حذف الرسالة لدى الجميع: " + (error?.message || "لم يتم تحديث الرسالة."), "error");
    return;
  }
  item.replaceChildren(safeText("p", "message-body deleted-message", "تم حذف هذه الرسالة."));
  item.classList.add("message-deleted");
  closeMessageOptions(menu, toggle);
  void loadConversations().catch(error => console.warn("تعذر تحديث معاينة المحادثة بعد الحذف:", error));
  announce("تم الحذف.", "success");
}
function appendMessage(message) {
  if (!message || document.querySelector('[data-message-id="' + message.id + '"]')) return;
  messagesList.querySelectorAll(".empty-item").forEach(node => node.remove());
  const item = document.createElement("li");
  item.className = message.sender_id === currentUser.id ? "message mine" : "message theirs";
  item.dataset.messageId = message.id;
  if (message.is_deleted) {
    item.classList.add("message-deleted");
    item.append(safeText("p", "message-body deleted-message", "تم حذف هذه الرسالة."));
    messagesList.append(item);
    messagesList.scrollTop = messagesList.scrollHeight;
    return;
  }
  const attachmentPrefix = "MERSAL_ATTACHMENT:";
  const attachmentIndex = (message.body || "").indexOf(attachmentPrefix);
  let attachment = null;
  if (attachmentIndex >= 0) {
    try { attachment = JSON.parse(message.body.slice(attachmentIndex + attachmentPrefix.length)); } catch { attachment = null; }
  }
  if (attachment?.path) {
    const attachmentView = document.createElement("div");
    attachmentView.className = "message-attachment";
    const fileName = attachment.name || "ملف مرفق";
    const fileInfo = safeText("p", "attachment-file-name", "📎 " + fileName);
    attachmentView.append(fileInfo);
    void supabase.storage.from("mersal-attachments").createSignedUrl(attachment.path, 3600).then(({ data, error }) => {
      if (error || !data?.signedUrl) {
        attachmentView.append(safeText("p", "attachment-unavailable", "تعذر فتح المرفق."));
        return;
      }
      const previewButton = safeText("button", "attachment-open-button",
        attachment.type?.startsWith("image/") ? "عرض الصورة داخل مرسال" :
        attachment.type?.startsWith("video/") ? "تشغيل الفيديو داخل مرسال" :
        attachment.type?.startsWith("audio/") || attachment.kind === "voice" ? "تشغيل الصوت داخل مرسال" :
        "عرض الملف داخل مرسال");
      previewButton.type = "button";
      previewButton.setAttribute("aria-label", (attachment.type?.startsWith("image/") ? "عرض الصورة " : attachment.type?.startsWith("video/") ? "تشغيل الفيديو " : attachment.type?.startsWith("audio/") || attachment.kind === "voice" ? "تشغيل الصوت " : "عرض الملف ") + fileName + " داخل المحادثة");
      previewButton.addEventListener("click", () => openAttachmentViewer(data.signedUrl, attachment.type || "", fileName, previewButton));
      if (attachment.type?.startsWith("image/")) {
        const preview = document.createElement("img");
        preview.src = data.signedUrl; preview.alt = "صورة مرفقة: " + fileName;
        preview.loading = "lazy"; preview.className = "attachment-image";
        previewButton.prepend(preview);
      } else {
        previewButton.prepend(safeText("span", "attachment-preview-icon", attachment.type?.startsWith("video/") ? "▶" : attachment.type?.startsWith("audio/") || attachment.kind === "voice" ? "♫" : "📄"));
      }
      attachmentView.insertBefore(previewButton, fileInfo);
    }).catch(() => attachmentView.append(safeText("p", "attachment-unavailable", "تعذر فتح المرفق.")));
    item.append(attachmentView);
  } else {
    item.append(safeText("p", "message-body", message.body));
  }
  const time = new Date(message.created_at).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "short" });
  item.append(safeText("time", "message-time", time));
  if (message.sender_id === currentUser.id && (privacySettings.read_receipts_enabled || activeConversation?.is_group)) {
    if (message._readCount > 0) item.append(safeText("span", "message-read-state", activeConversation?.is_group ? "مقروء من " + message._readCount : "مقروء"));
    else if (message._readByPartner) item.append(safeText("span", "message-read-state", "مقروء"));
  }
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const toggle = safeText("button", "message-options-toggle", "خيارات الرسالة");
  toggle.type = "button";
  toggle.setAttribute("aria-label", "خيارات الرسالة");
  toggle.setAttribute("aria-haspopup", "dialog");
  toggle.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "message-options";
  menu.setAttribute("aria-label", "خيارات الرسالة");
  menu.hidden = true;
  menu._home = actions;
  const closeButton = safeText("button", "message-option-button message-options-close", "إغلاق الخيارات");
  closeButton.type = "button";
  closeButton.addEventListener("click", () => closeMessageOptions(menu, toggle));
  toggle.addEventListener("click", () => {
    menu.hidden = false;
    menu.classList.add("is-open");
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-modal", "true");
    toggle.setAttribute("aria-expanded", "true");
    document.body.append(menu);
    closeButton.focus();
  });
  const copyButton = safeText("button", "message-option-button", "نسخ الرسالة");
  copyButton.setAttribute("aria-label", "نسخ الرسالة");
  copyButton.type = "button";
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.body || "");
      announce("تم نسخ الرسالة.");
    } catch {
      announce("تعذر نسخ الرسالة من هذا المتصفح.", "error");
    }
    closeMessageOptions(menu, toggle);
  });
  const replyButton = safeText("button", "message-option-button", "الرد على الرسالة");
  replyButton.setAttribute("aria-label", "الرد على الرسالة");
  replyButton.type = "button";
  replyButton.addEventListener("click", () => {
    replyingToMessage = { id: message.id, body: message.body || "" };
    replyingToText.textContent = "الرد على: " + (message.body || "");
    replyingTo.hidden = false;
    closeMessageOptions(menu, toggle);
    messageInput.focus();
    announce("اكتب ردك على الرسالة المحددة.");
  });
  const deleteMineButton = safeText("button", "message-option-button message-delete-button", "حذف لدي");
  deleteMineButton.setAttribute("aria-label", "حذف الرسالة لدي فقط");
  deleteMineButton.type = "button";
  deleteMineButton.addEventListener("click", () => { void deleteMessageForMe(message, item, menu, toggle); });
  const deleteEveryoneButton = safeText("button", "message-option-button message-delete-everyone-button", "حذف لدى الجميع");
  deleteEveryoneButton.setAttribute("aria-label", "حذف الرسالة لدى الجميع");
  deleteEveryoneButton.type = "button";
  deleteEveryoneButton.disabled = message.sender_id !== currentUser.id;
  deleteEveryoneButton.setAttribute("aria-label", message.sender_id === currentUser.id ? "حذف هذه الرسالة لدى الجميع" : "حذف لدى الجميع، متاح لرسائلك أنت فقط");
  deleteEveryoneButton.addEventListener("click", () => { void deleteMessageForEveryone(message, item, menu, toggle); });
  menu.append(closeButton, copyButton, replyButton, deleteMineButton, deleteEveryoneButton);
  actions.append(toggle, menu);
  item.append(actions);
  messagesList.append(item);
  messagesList.scrollTop = messagesList.scrollHeight;
}
async function loadMessages() {
  if (!activeConversation) return;
  if (!privacySettingsLoaded) await loadPrivacySettings();
  messagesList.replaceChildren();
  const { data, error } = await supabase.from("messages")
    .select("id,conversation_id,sender_id,body,created_at,is_deleted")
    .eq("conversation_id", activeConversation.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    announce("تعذر تحميل الرسائل: " + error.message, "error");
    return;
  }
  const { data: hiddenRows, error: hiddenError } = await supabase.from("message_hidden_for")
    .select("message_id").eq("user_id", currentUser.id);
  if (hiddenError) {
    announce("تعذر تحميل إعدادات إخفاء الرسائل: " + hiddenError.message, "error");
    return;
  }
  const hiddenIds = new Set((hiddenRows || []).map(row => row.message_id));
  const visibleMessages = (data || []).filter(message => !hiddenIds.has(message.id));
  if (privacySettings.read_receipts_enabled || activeConversation.is_group) {
    const incomingIds=visibleMessages.filter(message=>message.sender_id!==currentUser.id&&!message.is_deleted).map(message=>message.id);
    if(incomingIds.length){
      const receipts=await supabase.from("message_reads").upsert(incomingIds.map(message_id=>({message_id,user_id:currentUser.id})),{onConflict:"message_id,user_id",ignoreDuplicates:true});
      if(receipts.error)console.warn("تعذر تسجيل قراءة الرسائل:",receipts.error.message);
    }
    const ownIds=visibleMessages.filter(message=>message.sender_id===currentUser.id).map(message=>message.id);
    if(ownIds.length){
      let readQuery=supabase.from("message_reads").select("message_id,user_id").in("message_id",ownIds);
      if(!activeConversation.is_group&&activePartner)readQuery=readQuery.eq("user_id",activePartner.id);
      const readRows=await readQuery;
      if(!readRows.error){
        const counts=new Map();
        for(const row of readRows.data||[])counts.set(row.message_id,(counts.get(row.message_id)||0)+1);
        visibleMessages.forEach(message=>{
          if(message.sender_id===currentUser.id){
            if(activeConversation.is_group)message._readCount=counts.get(message.id)||0;
            else message._readByPartner=(counts.get(message.id)||0)>0;
          }
        });
      }
    }
  }
  if (!visibleMessages.length) messagesList.append(safeText("li", "empty-item", "هذه بداية المحادثة. أرسل أول رسالة."));
  for (const message of visibleMessages) appendMessage(message);
}
cancelReplyButton.addEventListener("click", () => { replyingToMessage = null; replyingTo.hidden = true; messageInput.focus(); });
$("#refresh-chat").addEventListener("click", () => { void loadMessages(); });

function localDateTimeValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function currentMessageBody() {
  const typedBody = messageInput.value.trim();
  return typedBody ? (replyingToMessage ? "ردًا على: " + replyingToMessage.body + "\n\n" + typedBody : typedBody) : "";
}
function openMessageSchedulePanel() {
  if (!activeConversation || !currentUser) return;
  if (isPrivateConversationBlocked()) {
    announce("لا يمكنك جدولة رسائل في هذه المحادثة بسبب الحظر.", "error");
    return;
  }
  const body = currentMessageBody();
  if (!body) {
    announce("اكتب الرسالة أولًا ثم اضغط مطولًا على زر الإرسال لجدولتها.", "error");
    messageInput.focus();
    return;
  }
  const minDate = new Date(Date.now() + 60 * 1000);
  const defaultDate = new Date(Date.now() + 10 * 60 * 1000);
  messageScheduleTimeInput.min = localDateTimeValue(minDate);
  messageScheduleTimeInput.value = localDateTimeValue(defaultDate);
  messageSchedulePreview.textContent = body;
  messageScheduleHelp.textContent = "اختر التاريخ والوقت، وسيتم إرسال الرسالة تلقائيًا حتى لو أغلقت مرسال.";
  messageSchedulePanel.hidden = false;
  closeMessageScheduleButton.focus();
}
function closeMessageSchedulePanel() {
  messageSchedulePanel.hidden = true;
  sendButton.focus();
}
closeMessageScheduleButton.addEventListener("click", closeMessageSchedulePanel);
messageSchedulePanel.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMessageSchedulePanel();
  }
});
confirmMessageScheduleButton.addEventListener("click", async () => {
  if (!activeConversation || !currentUser) return;
  const body = currentMessageBody();
  const scheduledAt = new Date(messageScheduleTimeInput.value);
  if (!body) {
    announce("اكتب الرسالة أولًا.", "error");
    closeMessageSchedulePanel();
    messageInput.focus();
    return;
  }
  if (!messageScheduleTimeInput.value || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 30000) {
    messageScheduleHelp.textContent = "اختر وقتًا لاحقًا من الوقت الحالي بدقيقة على الأقل.";
    messageScheduleTimeInput.focus();
    return;
  }
  if (isPrivateConversationBlocked()) {
    announce("لا يمكنك جدولة رسائل في هذه المحادثة بسبب الحظر.", "error");
    return;
  }
  confirmMessageScheduleButton.disabled = true;
  try {
    const { error } = await supabase.from("scheduled_messages").insert({
      conversation_id: activeConversation.id,
      sender_id: currentUser.id,
      body,
      scheduled_at: scheduledAt.toISOString()
    });
    if (error) throw error;
    messageInput.value = "";
    updateSendButtonVisibility();
    replyingToMessage = null;
    replyingTo.hidden = true;
    closeMessageSchedulePanel();
    announce("تمت جدولة الرسالة.", "success");
  } catch (error) {
    messageScheduleHelp.textContent = "تعذرت جدولة الرسالة: " + (error.message || "حاول مرة أخرى.");
  } finally {
    confirmMessageScheduleButton.disabled = isPrivateConversationBlocked();
  }
});
async function loadScheduledMessages() {
  if (!activeConversation || !currentUser) return;
  scheduledMessagesList.replaceChildren();
  const { data, error } = await supabase.from("scheduled_messages")
    .select("id,body,scheduled_at,status")
    .eq("conversation_id", activeConversation.id)
    .eq("sender_id", currentUser.id)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true });
  if (error) {
    scheduledMessagesList.append(safeText("li", "empty-item", "تعذر تحميل الرسائل المجدولة: " + error.message));
    return;
  }
  if (!data?.length) {
    scheduledMessagesList.append(safeText("li", "empty-item", "لا توجد رسائل مجدولة في هذه المحادثة."));
    return;
  }
  for (const scheduled of data) {
    const item = document.createElement("li");
    item.className = "scheduled-message-item";
    const body = safeText("p", "scheduled-message-body", scheduled.body);
    const time = safeText("p", "scheduled-message-time", "موعد الإرسال: " + new Intl.DateTimeFormat("ar-JO", { dateStyle: "long", timeStyle: "short" }).format(new Date(scheduled.scheduled_at)));
    const cancel = safeText("button", "danger-button", "إلغاء الجدولة");
    cancel.type = "button";
    cancel.addEventListener("click", async () => {
      cancel.disabled = true;
      const { data: updated, error: updateError } = await supabase.from("scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", scheduled.id)
        .eq("sender_id", currentUser.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (updateError || !updated) {
        cancel.disabled = false;
        announce("تعذر إلغاء جدولة الرسالة: " + (updateError?.message || "ربما حان موعد إرسالها."), "error");
        return;
      }
      announce("تم إلغاء جدولة الرسالة.", "success");
      await loadScheduledMessages();
    });
    item.append(body, time, cancel);
    scheduledMessagesList.append(item);
  }
}
scheduledMessagesButton.addEventListener("click", async () => {
  if (!activeConversation) return;
  scheduledMessagesPanel.hidden = false;
  await loadScheduledMessages();
  closeScheduledMessagesButton.focus();
});
closeScheduledMessagesButton.addEventListener("click", () => {
  scheduledMessagesPanel.hidden = true;
  scheduledMessagesButton.focus();
});
scheduledMessagesPanel.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    scheduledMessagesPanel.hidden = true;
    scheduledMessagesButton.focus();
  }
});
let sendLongPressTimer = null;
let suppressScheduledSendClick = false;
function clearSendLongPress() {
  if (sendLongPressTimer !== null) clearTimeout(sendLongPressTimer);
  sendLongPressTimer = null;
}
sendButton.addEventListener("pointerdown", event => {
  if (sendButton.disabled || event.button !== 0) return;
  suppressScheduledSendClick = false;
  clearSendLongPress();
  sendLongPressTimer = window.setTimeout(() => {
    suppressScheduledSendClick = true;
    window.setTimeout(() => { suppressScheduledSendClick = false; }, 1000);
    openMessageSchedulePanel();
  }, 650);
});
for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
  sendButton.addEventListener(eventName, clearSendLongPress);
}
sendButton.addEventListener("contextmenu", event => {
  event.preventDefault();
  clearSendLongPress();
  openMessageSchedulePanel();
});
sendButton.addEventListener("keydown", event => {
  if (event.key === "ContextMenu" || (event.altKey && event.key === "ArrowDown") || (event.shiftKey && event.key === "F10")) {
    event.preventDefault();
    openMessageSchedulePanel();
  }
});
sendButton.addEventListener("click", event => {
  if (suppressScheduledSendClick) {
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressScheduledSendClick = false;
  }
});


function closeAttachmentChooser() {
  attachmentChooser.hidden = true;
  attachButton.focus();
}
attachButton.addEventListener("click", () => {
  attachmentChooser.hidden = false;
  closeAttachmentChooserButton.focus();
});
closeAttachmentChooserButton.addEventListener("click", closeAttachmentChooser);
attachmentChooser.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAttachmentChooser();
});
$("#choose-images").addEventListener("click", () => imageFileInput.click());
$("#choose-videos").addEventListener("click", () => videoFileInput.click());
$("#choose-files").addEventListener("click", () => documentFileInput.click());

async function uploadAttachments(fileList, options = {}) {
  const files = [...(fileList || [])];
  if (!files.length || !currentUser || !activeConversation) return;
  if(isPrivateConversationBlocked()){announce("لا يمكنك إرسال مرفقات في هذه المحادثة بسبب الحظر.","error");return;}
  closeAttachmentChooser();
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      announce("حجم الملف " + file.name + " أكبر من 50 ميغابايت.", "error");
      continue;
    }
    sendButton.disabled = true;
    attachButton.disabled = true;
    announce("جارٍ رفع " + file.name + "…");
    try {
      // Use an ASCII-only storage object key. Keep the original filename only as message metadata.
      const extensionMatch = String(file.name || "").match(/\.([a-zA-Z0-9]{1,10})$/);
      const safeExtension = extensionMatch ? "." + extensionMatch[1].toLowerCase() : "";
      const unique = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
      const path = activeConversation.id + "/" + currentUser.id + "/" + unique + safeExtension;
      const { data: uploaded, error: uploadError } = await supabase.storage.from("mersal-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (uploadError) throw uploadError;
      const attachment = { path: uploaded.path, name: file.name, type: file.type || "application/octet-stream", size: file.size, ...(options.voiceMessage ? { kind: "voice" } : {}) };
      const body = (options.voiceMessage ? "رسالة صوتية" : "📎 " + file.name) + "\\nMERSAL_ATTACHMENT:" + JSON.stringify(attachment);
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id, sender_id: currentUser.id, body
      }).select("id,conversation_id,sender_id,body,created_at").single();
      if (error) {
        await supabase.storage.from("mersal-attachments").remove([uploaded.path]);
        throw error;
      }
      appendMessage(data);
      await loadConversations();
      const { error: pushError } = await supabase.functions.invoke("send-push", { body: { message_id: data.id } });
      if (pushError) console.warn("Push notification could not be sent:", pushError.message);
      announce("تم الإرسال.", "success");
    } catch (error) {
      announce("تعذر إرسال الملف " + file.name + ": " + (error.message || "حاول مرة أخرى."), "error");
    } finally {
      sendButton.disabled = false;
      attachButton.disabled = false;
    }
  }
}
for (const input of [imageFileInput, videoFileInput, documentFileInput]) {
  input.addEventListener("change", () => {
    void uploadAttachments(input.files);
    input.value = "";
  });
}

messageInput.addEventListener("input", updateSendButtonVisibility);
updateSendButtonVisibility();

messageInput.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || !chatEnterToSendInput.checked) return;
  event.preventDefault();
  messageForm.requestSubmit();
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typedBody = messageInput.value.trim();
  if (!typedBody) {
    announce("اكتب رسالتك قبل الإرسال.");
    return;
  }
  if (!activeConversation || !currentUser) return;
  if(isPrivateConversationBlocked()){announce("لا يمكنك إرسال رسائل في هذه المحادثة بسبب الحظر.","error");return;}
  const body = replyingToMessage ? "ردًا على: " + replyingToMessage.body + "\n\n" + typedBody : typedBody;
  sendButton.disabled = true;
  const { data, error } = await supabase.from("messages").insert({
    conversation_id: activeConversation.id, sender_id: currentUser.id, body
  }).select("id,conversation_id,sender_id,body,created_at").single();
  if (error) {
    announce("تعذر إرسال الرسالة: " + error.message, "error");
  } else {
    messageInput.value = "";
    replyingToMessage = null;
    replyingTo.hidden = true;
    appendMessage(data);
    await loadConversations();
    const { error: pushError } = await supabase.functions.invoke("send-push", { body: { message_id: data.id } });
    if (pushError) console.warn("Push notification could not be sent:", pushError.message);
    announce("تم الإرسال.", "success");
  }
  sendButton.disabled = false;
  messageInput.focus();
});

const { data: initial, error: initialError } = await supabase.auth.getSession();
if (initialError) {
  showLoggedOut("تعذر التحقق من الجلسة: " + initialError.message);
} else {
  await handleSession(initial.session);
}
const params = getCallbackParams();
if (params.has("error") || params.has("error_code")) {
  announce("فشل تسجيل الدخول: " + (params.get("error_description") || params.get("error_code") || params.get("error") || "رفض Google الطلب"), "error");
}
