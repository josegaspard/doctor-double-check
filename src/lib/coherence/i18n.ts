// Textos de los arreglos de coherencia del 24-nov-2026: lista de espera de
// pacientes, señales de confianza comprobables, bloque de precios para médicos,
// bloque de seguridad de /emergency y estado de los lives en la portada.
// Diccionario pequeño y aparte (mismo patrón que lib/healthTools/i18n) para no
// tocar los 8 diccionarios grandes. Si falta una clave en un idioma, sale la
// castellana.
import { useLanguage } from '@/contexts/LanguageContext';

const es = {
  fp: { network: 'Médicos con cédula verificada en distintas especialidades, con su perfil y sus credenciales a la vista.' },
  res: { heroSub: 'Únete a la comunidad académica de residentes médicos. Aprende, colabora y crece profesionalmente.', ctaSub: 'Regístrate hoy y empieza a conectar con otros residentes y con médicos verificados.' },
  wl: {
    badge: 'Pacientes: próximamente',
    cta: 'Únete a la lista de espera',
    title: 'Pacientes: próximamente',
    body: 'Por ahora Medical Masters está abierto solo a médicos y residentes. Déjanos tu correo y te avisamos en cuanto se abran las cuentas de pacientes.',
    profileNote: 'Las consultas, el chat y las suscripciones para pacientes se abrirán pronto.',
    name: 'Nombre',
    email: 'Correo electrónico',
    interest: '¿Qué especialidad te interesa? (opcional)',
    submit: 'Avisarme',
    sending: 'Enviando…',
    done: '¡Listo! Estás en la lista',
    doneBody: 'Te escribiremos a ese correo cuando abramos las cuentas de pacientes.',
    error: 'No se pudo guardar. Inténtalo de nuevo en un momento.',
    invalid: 'Escribe tu nombre y un correo válido.',
    privacy: 'Solo usaremos tu correo para avisarte de la apertura.',
    doctorQ: '¿Eres médico? Crea tu cuenta',
    close: 'Cerrar',
  },
  live: {
    upcomingBadge: 'Próximos lives',
    upcomingShort: 'Próximo live',
    soon: 'Próximamente',
  },
  hero: {
    languages: '8 idiomas',
    verified: 'Cédula verificada',
  },
  trust: {
    title: 'Lo que puedes comprobar',
    subtitle: 'Sin cifras infladas: así funciona la plataforma hoy.',
    cedulaT: 'Cédula profesional verificada',
    cedulaD: 'Cada médico registra su cédula y el equipo la revisa en el Registro Nacional de Profesionistas (SEP) antes de aprobar su perfil.',
    cofeprisT: 'Permisos COFEPRIS revisados',
    cofeprisD: 'Cuando un médico sube un permiso COFEPRIS, el equipo lo revisa antes de mostrarlo en su perfil.',
    dailyT: 'Videoconsultas cifradas',
    dailyD: 'Las videollamadas usan Daily.co con cifrado en tránsito y salas privadas: solo entra quien tiene acceso a la consulta.',
    invoiceT: 'Pagos con Stripe y factura',
    invoiceD: 'Los cobros se procesan con Stripe y cada retiro del médico se respalda con su factura (CFDI) a su RFC.',
  },
  ss: {
    storiesTitle: 'Casos reales, con permiso',
    storiesBody: 'Estamos documentando los primeros casos de médicos en la plataforma. Los publicaremos con su nombre y su autorización; mientras tanto, esto es lo que sí puedes comprobar.',
  },
  fd: {
    subtitle: 'Da consultas en línea, transmite lives y cobra desde un solo lugar, con tu cédula verificada.',
    pricingTitle: 'Cuánto cobras y cuánto recibes',
    pricingSub: 'Tú pones tu precio. Estas son las condiciones vigentes de la plataforma.',
    commission: '{pct} % de comisión',
    commissionD: 'Por cada consulta, chat, live o grabación que cobras, tú recibes el {rest} %.',
    example: 'Ejemplo: cobras {fee} → recibes {net}',
    payout: 'Retiro semanal desde {min}',
    payoutD: 'Se deposita en tu cuenta bancaria, con tu factura (CFDI).',
    wallet: 'Recarga mínima de {min}',
    walletD: 'Lo mínimo que se puede cargar al monedero para pagar en la plataforma.',
    market: 'Marketplace médico: {pct} %',
    marketD: 'Comisión por cada venta de productos o equipos en el marketplace.',
  },
  em: {
    safetyTitle: '¿Es una emergencia?',
    safetyBody: 'Si tú o alguien más está en peligro, no esperes una videoconsulta: llama al 911 o acude a urgencias.',
    call911: 'Llamar al 911',
    lineaVida: 'Línea de la Vida: 800 911 2000',
    lineaVidaD: 'Gratis y las 24 horas: apoyo en crisis emocional, ideas suicidas y adicciones.',
    emptyTitle: 'Ahora mismo no hay médicos disponibles',
    emptyBody: 'Vuelve a intentarlo más tarde o busca en el directorio. Si es urgente, llama al 911.',
    directory: 'Ver directorio médico',
  },
};

type Dict = typeof es;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const en: DeepPartial<Dict> = {
  fp: { network: 'Doctors with verified licenses across specialties, with their profile and credentials in plain view.' },
  res: { heroSub: 'Join the academic community for medical residents. Learn, collaborate and grow professionally.', ctaSub: 'Sign up today and start connecting with other residents and verified doctors.' },
  wl: {
    badge: 'Patients: coming soon', cta: 'Join the waitlist', title: 'Patients: coming soon',
    body: 'For now Medical Masters is open only to doctors and residents. Leave your email and we will let you know as soon as patient accounts open.',
    profileNote: 'Consultations, chat and subscriptions for patients will open soon.',
    name: 'Name', email: 'Email', interest: 'Which specialty are you interested in? (optional)',
    submit: 'Notify me', sending: 'Sending…', done: 'Done! You are on the list',
    doneBody: 'We will write to that email when patient accounts open.',
    error: 'Could not save. Please try again in a moment.', invalid: 'Enter your name and a valid email.',
    privacy: 'We will only use your email to tell you when we open.', doctorQ: 'Are you a doctor? Create your account', close: 'Close',
  },
  live: { upcomingBadge: 'Upcoming lives', upcomingShort: 'Upcoming live', soon: 'Coming soon' },
  hero: { languages: '8 languages', verified: 'Verified license' },
  trust: {
    title: 'What you can verify', subtitle: 'No inflated numbers: this is how the platform works today.',
    cedulaT: 'Verified medical license', cedulaD: 'Every doctor registers their professional license (cédula) and the team checks it in Mexico’s National Registry of Professionals (SEP) before approving the profile.',
    cofeprisT: 'COFEPRIS permits reviewed', cofeprisD: 'When a doctor uploads a COFEPRIS permit, the team reviews it before showing it on their profile.',
    dailyT: 'Encrypted video consultations', dailyD: 'Video calls run on Daily.co with encryption in transit and private rooms: only people with access to the consultation can join.',
    invoiceT: 'Stripe payments and invoices', invoiceD: 'Payments are processed by Stripe and every doctor payout is backed by their tax invoice (CFDI) under their RFC.',
  },
  ss: { storiesTitle: 'Real cases, with permission', storiesBody: 'We are documenting the first doctors’ cases on the platform. We will publish them with their name and consent; meanwhile, this is what you can verify.' },
  fd: {
    subtitle: 'Give online consultations, stream lives and get paid in one place, with your license verified.',
    pricingTitle: 'What you charge and what you get', pricingSub: 'You set your price. These are the platform’s current terms.',
    commission: '{pct}% commission', commissionD: 'For every consultation, chat, live or recording you charge, you keep {rest}%.',
    example: 'Example: you charge {fee} → you get {net}', payout: 'Weekly payout from {min}', payoutD: 'Paid to your bank account, with your tax invoice (CFDI).',
    wallet: 'Minimum top-up {min}', walletD: 'The minimum amount that can be loaded into the wallet to pay on the platform.',
    market: 'Medical marketplace: {pct}%', marketD: 'Commission on each sale of products or equipment in the marketplace.',
  },
  em: {
    safetyTitle: 'Is this an emergency?', safetyBody: 'If you or someone else is in danger, do not wait for a video call: call 911 or go to the emergency room.',
    call911: 'Call 911', lineaVida: 'Línea de la Vida: 800 911 2000', lineaVidaD: 'Free, 24 hours: support for emotional crises, suicidal thoughts and addictions.',
    emptyTitle: 'No doctors are available right now', emptyBody: 'Try again later or search the directory. If it is urgent, call 911.', directory: 'Open the doctor directory',
  },
};

const pt: DeepPartial<Dict> = {
  fp: { network: 'Médicos com registro verificado em diversas especialidades, com perfil e credenciais à vista.' },
  res: { heroSub: 'Junte-se à comunidade acadêmica de residentes médicos. Aprenda, colabore e cresça profissionalmente.', ctaSub: 'Cadastre-se hoje e comece a se conectar com outros residentes e médicos verificados.' },
  wl: {
    badge: 'Pacientes: em breve', cta: 'Entre na lista de espera', title: 'Pacientes: em breve',
    body: 'Por enquanto o Medical Masters está aberto apenas a médicos e residentes. Deixe seu e-mail e avisaremos assim que as contas de pacientes abrirem.',
    profileNote: 'Consultas, chat e assinaturas para pacientes abrirão em breve.',
    name: 'Nome', email: 'E-mail', interest: 'Qual especialidade lhe interessa? (opcional)',
    submit: 'Avise-me', sending: 'Enviando…', done: 'Pronto! Você está na lista',
    doneBody: 'Escreveremos para esse e-mail quando abrirmos as contas de pacientes.',
    error: 'Não foi possível salvar. Tente novamente em instantes.', invalid: 'Escreva seu nome e um e-mail válido.',
    privacy: 'Usaremos seu e-mail apenas para avisar da abertura.', doctorQ: 'É médico? Crie sua conta', close: 'Fechar',
  },
  live: { upcomingBadge: 'Próximos lives', upcomingShort: 'Próximo live', soon: 'Em breve' },
  hero: { languages: '8 idiomas', verified: 'Registro verificado' },
  trust: {
    title: 'O que você pode comprovar', subtitle: 'Sem números inflados: assim funciona a plataforma hoje.',
    cedulaT: 'Registro profissional verificado', cedulaD: 'Cada médico registra sua cédula profissional e a equipe a confere no Registro Nacional de Profissionais (SEP) do México antes de aprovar o perfil.',
    cofeprisT: 'Licenças COFEPRIS revisadas', cofeprisD: 'Quando um médico envia uma licença COFEPRIS, a equipe a revisa antes de exibi-la no perfil.',
    dailyT: 'Videoconsultas criptografadas', dailyD: 'As videochamadas usam Daily.co com criptografia em trânsito e salas privadas: só entra quem tem acesso à consulta.',
    invoiceT: 'Pagamentos com Stripe e nota fiscal', invoiceD: 'Os pagamentos são processados pela Stripe e cada saque do médico é respaldado por sua nota fiscal (CFDI) com seu RFC.',
  },
  ss: { storiesTitle: 'Casos reais, com permissão', storiesBody: 'Estamos documentando os primeiros casos de médicos na plataforma. Vamos publicá-los com nome e autorização; enquanto isso, isto é o que você pode comprovar.' },
  fd: {
    subtitle: 'Faça consultas online, transmita lives e receba em um só lugar, com seu registro verificado.',
    pricingTitle: 'Quanto você cobra e quanto recebe', pricingSub: 'Você define seu preço. Estas são as condições vigentes da plataforma.',
    commission: '{pct}% de comissão', commissionD: 'Em cada consulta, chat, live ou gravação que você cobra, você recebe {rest}%.',
    example: 'Exemplo: você cobra {fee} → recebe {net}', payout: 'Saque semanal a partir de {min}', payoutD: 'Depositado na sua conta bancária, com sua nota fiscal (CFDI).',
    wallet: 'Recarga mínima de {min}', walletD: 'O mínimo que se pode carregar na carteira para pagar na plataforma.',
    market: 'Marketplace médico: {pct}%', marketD: 'Comissão por venda de produtos ou equipamentos no marketplace.',
  },
  em: {
    safetyTitle: 'É uma emergência?', safetyBody: 'Se você ou outra pessoa estiver em perigo, não espere uma videoconsulta: ligue para o 911 ou vá ao pronto-socorro.',
    call911: 'Ligar para o 911', lineaVida: 'Línea de la Vida: 800 911 2000', lineaVidaD: 'Gratuita, 24 horas: apoio em crises emocionais, ideação suicida e dependências.',
    emptyTitle: 'Agora não há médicos disponíveis', emptyBody: 'Tente mais tarde ou procure no diretório. Se for urgente, ligue para o 911.', directory: 'Ver diretório médico',
  },
};

const fr: DeepPartial<Dict> = {
  fp: { network: 'Des médecins à la licence vérifiée dans différentes spécialités, avec leur profil et leurs diplômes visibles.' },
  res: { heroSub: 'Rejoignez la communauté académique des internes en médecine. Apprenez, collaborez et progressez.', ctaSub: 'Inscrivez-vous dès aujourd’hui et échangez avec d’autres internes et des médecins vérifiés.' },
  wl: {
    badge: 'Patients : bientôt', cta: 'Rejoindre la liste d’attente', title: 'Patients : bientôt',
    body: 'Pour l’instant, Medical Masters est ouvert uniquement aux médecins et aux internes. Laissez votre e-mail et nous vous préviendrons dès l’ouverture des comptes patients.',
    profileNote: 'Les consultations, le chat et les abonnements pour les patients ouvriront bientôt.',
    name: 'Nom', email: 'E-mail', interest: 'Quelle spécialité vous intéresse ? (facultatif)',
    submit: 'Me prévenir', sending: 'Envoi…', done: 'C’est fait ! Vous êtes sur la liste',
    doneBody: 'Nous écrirons à cette adresse à l’ouverture des comptes patients.',
    error: 'Enregistrement impossible. Réessayez dans un instant.', invalid: 'Indiquez votre nom et un e-mail valide.',
    privacy: 'Votre e-mail servira uniquement à vous prévenir de l’ouverture.', doctorQ: 'Vous êtes médecin ? Créez votre compte', close: 'Fermer',
  },
  live: { upcomingBadge: 'Prochains lives', upcomingShort: 'Prochain live', soon: 'Bientôt' },
  hero: { languages: '8 langues', verified: 'Diplôme vérifié' },
  trust: {
    title: 'Ce que vous pouvez vérifier', subtitle: 'Pas de chiffres gonflés : voici comment fonctionne la plateforme aujourd’hui.',
    cedulaT: 'Licence professionnelle vérifiée', cedulaD: 'Chaque médecin enregistre sa cédula professionnelle et l’équipe la vérifie dans le Registre national des professionnels (SEP) du Mexique avant d’approuver le profil.',
    cofeprisT: 'Autorisations COFEPRIS examinées', cofeprisD: 'Lorsqu’un médecin dépose une autorisation COFEPRIS, l’équipe l’examine avant de l’afficher sur son profil.',
    dailyT: 'Téléconsultations chiffrées', dailyD: 'Les appels vidéo passent par Daily.co, chiffrés en transit, dans des salles privées : seules les personnes ayant accès à la consultation peuvent entrer.',
    invoiceT: 'Paiements Stripe et facture', invoiceD: 'Les paiements sont traités par Stripe et chaque versement au médecin est justifié par sa facture (CFDI) à son RFC.',
  },
  ss: { storiesTitle: 'De vrais cas, avec autorisation', storiesBody: 'Nous documentons les premiers cas de médecins sur la plateforme. Nous les publierons avec leur nom et leur accord ; en attendant, voici ce que vous pouvez vérifier.' },
  fd: {
    subtitle: 'Donnez des consultations en ligne, diffusez des lives et encaissez au même endroit, avec votre licence vérifiée.',
    pricingTitle: 'Ce que vous facturez et ce que vous recevez', pricingSub: 'Vous fixez votre prix. Voici les conditions actuelles de la plateforme.',
    commission: '{pct} % de commission', commissionD: 'Pour chaque consultation, chat, live ou enregistrement facturé, vous recevez {rest} %.',
    example: 'Exemple : vous facturez {fee} → vous recevez {net}', payout: 'Retrait hebdomadaire dès {min}', payoutD: 'Versé sur votre compte bancaire, avec votre facture (CFDI).',
    wallet: 'Recharge minimale de {min}', walletD: 'Le montant minimum que l’on peut charger dans le portefeuille pour payer sur la plateforme.',
    market: 'Marketplace médicale : {pct} %', marketD: 'Commission sur chaque vente de produits ou d’équipements dans la marketplace.',
  },
  em: {
    safetyTitle: 'Est-ce une urgence ?', safetyBody: 'Si vous ou quelqu’un d’autre êtes en danger, n’attendez pas une téléconsultation : appelez le 911 ou rendez-vous aux urgences.',
    call911: 'Appeler le 911', lineaVida: 'Línea de la Vida : 800 911 2000', lineaVidaD: 'Gratuite, 24 h/24 : soutien en cas de crise émotionnelle, d’idées suicidaires et d’addictions.',
    emptyTitle: 'Aucun médecin disponible pour le moment', emptyBody: 'Réessayez plus tard ou cherchez dans l’annuaire. En cas d’urgence, appelez le 911.', directory: 'Voir l’annuaire médical',
  },
};

const it: DeepPartial<Dict> = {
  fp: { network: 'Medici con abilitazione verificata in diverse specialità, con profilo e credenziali in vista.' },
  res: { heroSub: 'Unisciti alla comunità accademica degli specializzandi in medicina. Impara, collabora e cresci professionalmente.', ctaSub: 'Registrati oggi e inizia a connetterti con altri specializzandi e con medici verificati.' },
  wl: {
    badge: 'Pazienti: in arrivo', cta: 'Iscriviti alla lista d’attesa', title: 'Pazienti: in arrivo',
    body: 'Per ora Medical Masters è aperto solo a medici e specializzandi. Lasciaci la tua e-mail e ti avviseremo appena apriranno gli account dei pazienti.',
    profileNote: 'Consulti, chat e abbonamenti per i pazienti apriranno a breve.',
    name: 'Nome', email: 'E-mail', interest: 'Quale specialità ti interessa? (facoltativo)',
    submit: 'Avvisami', sending: 'Invio…', done: 'Fatto! Sei nella lista',
    doneBody: 'Ti scriveremo a quell’indirizzo quando apriremo gli account dei pazienti.',
    error: 'Impossibile salvare. Riprova tra un momento.', invalid: 'Scrivi il tuo nome e un’e-mail valida.',
    privacy: 'Useremo la tua e-mail solo per avvisarti dell’apertura.', doctorQ: 'Sei un medico? Crea il tuo account', close: 'Chiudi',
  },
  live: { upcomingBadge: 'Prossimi live', upcomingShort: 'Prossimo live', soon: 'In arrivo' },
  hero: { languages: '8 lingue', verified: 'Abilitazione verificata' },
  trust: {
    title: 'Quello che puoi verificare', subtitle: 'Niente numeri gonfiati: ecco come funziona oggi la piattaforma.',
    cedulaT: 'Abilitazione professionale verificata', cedulaD: 'Ogni medico registra la sua cédula professionale e il team la controlla nel Registro nazionale dei professionisti (SEP) del Messico prima di approvare il profilo.',
    cofeprisT: 'Permessi COFEPRIS verificati', cofeprisD: 'Quando un medico carica un permesso COFEPRIS, il team lo verifica prima di mostrarlo nel profilo.',
    dailyT: 'Videoconsulti cifrati', dailyD: 'Le videochiamate usano Daily.co con cifratura in transito e stanze private: entra solo chi ha accesso al consulto.',
    invoiceT: 'Pagamenti con Stripe e fattura', invoiceD: 'I pagamenti sono gestiti da Stripe e ogni prelievo del medico è supportato dalla sua fattura (CFDI) con il suo RFC.',
  },
  ss: { storiesTitle: 'Casi reali, con permesso', storiesBody: 'Stiamo documentando i primi casi di medici sulla piattaforma. Li pubblicheremo con nome e autorizzazione; nel frattempo, ecco cosa puoi verificare.' },
  fd: {
    subtitle: 'Fai consulti online, trasmetti live e incassa in un unico posto, con la tua abilitazione verificata.',
    pricingTitle: 'Quanto fai pagare e quanto ricevi', pricingSub: 'Il prezzo lo decidi tu. Queste sono le condizioni attuali della piattaforma.',
    commission: 'Commissione del {pct}%', commissionD: 'Per ogni consulto, chat, live o registrazione che fai pagare, ricevi il {rest}%.',
    example: 'Esempio: fai pagare {fee} → ricevi {net}', payout: 'Prelievo settimanale da {min}', payoutD: 'Accreditato sul tuo conto bancario, con la tua fattura (CFDI).',
    wallet: 'Ricarica minima di {min}', walletD: 'L’importo minimo che si può caricare nel portafoglio per pagare sulla piattaforma.',
    market: 'Marketplace medico: {pct}%', marketD: 'Commissione su ogni vendita di prodotti o attrezzature nel marketplace.',
  },
  em: {
    safetyTitle: 'È un’emergenza?', safetyBody: 'Se tu o qualcun altro siete in pericolo, non aspettare una videochiamata: chiama il 911 o vai al pronto soccorso.',
    call911: 'Chiama il 911', lineaVida: 'Línea de la Vida: 800 911 2000', lineaVidaD: 'Gratuita, 24 ore su 24: supporto in caso di crisi emotive, pensieri suicidi e dipendenze.',
    emptyTitle: 'Al momento non ci sono medici disponibili', emptyBody: 'Riprova più tardi o cerca nella directory. Se è urgente, chiama il 911.', directory: 'Vai alla directory medica',
  },
};

const de: DeepPartial<Dict> = {
  fp: { network: 'Ärztinnen und Ärzte mit geprüfter Zulassung in verschiedenen Fachgebieten, mit sichtbarem Profil und Nachweisen.' },
  res: { heroSub: 'Werden Sie Teil der akademischen Community für Assistenzärzte. Lernen, zusammenarbeiten und beruflich wachsen.', ctaSub: 'Registrieren Sie sich noch heute und vernetzen Sie sich mit anderen Assistenzärzten und geprüften Ärzten.' },
  wl: {
    badge: 'Patienten: demnächst', cta: 'Auf die Warteliste', title: 'Patienten: demnächst',
    body: 'Derzeit ist Medical Masters nur für Ärztinnen, Ärzte und Assistenzärzte geöffnet. Hinterlassen Sie Ihre E-Mail und wir melden uns, sobald Patientenkonten öffnen.',
    profileNote: 'Konsultationen, Chat und Abos für Patienten öffnen in Kürze.',
    name: 'Name', email: 'E-Mail', interest: 'Welches Fachgebiet interessiert Sie? (optional)',
    submit: 'Benachrichtigen', sending: 'Wird gesendet…', done: 'Fertig! Sie stehen auf der Liste',
    doneBody: 'Wir schreiben an diese Adresse, sobald Patientenkonten öffnen.',
    error: 'Speichern nicht möglich. Bitte gleich noch einmal versuchen.', invalid: 'Bitte Namen und eine gültige E-Mail angeben.',
    privacy: 'Wir nutzen Ihre E-Mail nur, um Sie über die Öffnung zu informieren.', doctorQ: 'Sind Sie Ärztin oder Arzt? Konto erstellen', close: 'Schließen',
  },
  live: { upcomingBadge: 'Nächste Lives', upcomingShort: 'Nächstes Live', soon: 'Demnächst' },
  hero: { languages: '8 Sprachen', verified: 'Approbation geprüft' },
  trust: {
    title: 'Was Sie überprüfen können', subtitle: 'Keine aufgeblähten Zahlen: So funktioniert die Plattform heute.',
    cedulaT: 'Berufszulassung geprüft', cedulaD: 'Jede Ärztin und jeder Arzt registriert die Berufslizenz (Cédula) und das Team prüft sie im mexikanischen Nationalregister der Berufe (SEP), bevor das Profil freigegeben wird.',
    cofeprisT: 'COFEPRIS-Genehmigungen geprüft', cofeprisD: 'Lädt eine Ärztin oder ein Arzt eine COFEPRIS-Genehmigung hoch, prüft das Team sie, bevor sie im Profil erscheint.',
    dailyT: 'Verschlüsselte Videosprechstunden', dailyD: 'Videoanrufe laufen über Daily.co mit Transportverschlüsselung und privaten Räumen: Nur wer Zugang zur Konsultation hat, kommt hinein.',
    invoiceT: 'Zahlungen über Stripe mit Rechnung', invoiceD: 'Zahlungen werden über Stripe abgewickelt, und jede Auszahlung an Ärzte ist durch ihre Steuerrechnung (CFDI) mit RFC belegt.',
  },
  ss: { storiesTitle: 'Echte Fälle, mit Erlaubnis', storiesBody: 'Wir dokumentieren gerade die ersten Fälle von Ärztinnen und Ärzten auf der Plattform. Wir veröffentlichen sie mit Namen und Zustimmung; bis dahin können Sie Folgendes überprüfen.' },
  fd: {
    subtitle: 'Online-Sprechstunden, Live-Übertragungen und Abrechnung an einem Ort, mit geprüfter Zulassung.',
    pricingTitle: 'Was Sie berechnen und was Sie erhalten', pricingSub: 'Den Preis legen Sie fest. Das sind die aktuellen Bedingungen der Plattform.',
    commission: '{pct} % Provision', commissionD: 'Bei jeder Konsultation, jedem Chat, Live oder jeder Aufzeichnung, die Sie berechnen, erhalten Sie {rest} %.',
    example: 'Beispiel: Sie berechnen {fee} → Sie erhalten {net}', payout: 'Wöchentliche Auszahlung ab {min}', payoutD: 'Auf Ihr Bankkonto, mit Ihrer Steuerrechnung (CFDI).',
    wallet: 'Mindestaufladung {min}', walletD: 'Der Mindestbetrag, der zum Bezahlen auf der Plattform ins Guthaben geladen werden kann.',
    market: 'Medizinischer Marktplatz: {pct} %', marketD: 'Provision auf jeden Verkauf von Produkten oder Geräten im Marktplatz.',
  },
  em: {
    safetyTitle: 'Ist es ein Notfall?', safetyBody: 'Wenn Sie oder jemand anderes in Gefahr sind, warten Sie nicht auf einen Videoanruf: Rufen Sie die 911 an oder gehen Sie in die Notaufnahme.',
    call911: '911 anrufen', lineaVida: 'Línea de la Vida: 800 911 2000', lineaVidaD: 'Kostenlos, rund um die Uhr: Hilfe bei seelischen Krisen, Suizidgedanken und Sucht.',
    emptyTitle: 'Gerade ist keine Ärztin und kein Arzt verfügbar', emptyBody: 'Versuchen Sie es später erneut oder suchen Sie im Verzeichnis. Im Notfall rufen Sie die 911 an.', directory: 'Ärzteverzeichnis öffnen',
  },
};

const ca: DeepPartial<Dict> = {
  fp: { network: 'Metges amb cèdula verificada en diferents especialitats, amb el seu perfil i les seves credencials a la vista.' },
  res: { heroSub: 'Uneix-te a la comunitat acadèmica de residents de medicina. Aprèn, col·labora i creix professionalment.', ctaSub: 'Registra’t avui i comença a connectar amb altres residents i amb metges verificats.' },
  wl: {
    badge: 'Pacients: aviat', cta: 'Uneix-te a la llista d’espera', title: 'Pacients: aviat',
    body: 'De moment Medical Masters només és obert a metges i residents. Deixa’ns el teu correu i t’avisarem tan bon punt s’obrin els comptes de pacients.',
    profileNote: 'Les consultes, el xat i les subscripcions per a pacients s’obriran aviat.',
    name: 'Nom', email: 'Correu electrònic', interest: 'Quina especialitat t’interessa? (opcional)',
    submit: 'Avisa’m', sending: 'Enviant…', done: 'Fet! Ja ets a la llista',
    doneBody: 'T’escriurem a aquest correu quan obrim els comptes de pacients.',
    error: 'No s’ha pogut desar. Torna-ho a provar d’aquí a un moment.', invalid: 'Escriu el teu nom i un correu vàlid.',
    privacy: 'Només farem servir el teu correu per avisar-te de l’obertura.', doctorQ: 'Ets metge? Crea el teu compte', close: 'Tanca',
  },
  live: { upcomingBadge: 'Propers lives', upcomingShort: 'Proper live', soon: 'Aviat' },
  hero: { languages: '8 idiomes', verified: 'Cèdula verificada' },
  trust: {
    title: 'El que pots comprovar', subtitle: 'Sense xifres inflades: així funciona avui la plataforma.',
    cedulaT: 'Cèdula professional verificada', cedulaD: 'Cada metge registra la seva cèdula i l’equip la comprova al Registre Nacional de Professionals (SEP) de Mèxic abans d’aprovar-ne el perfil.',
    cofeprisT: 'Permisos COFEPRIS revisats', cofeprisD: 'Quan un metge puja un permís COFEPRIS, l’equip el revisa abans de mostrar-lo al perfil.',
    dailyT: 'Videoconsultes xifrades', dailyD: 'Les videotrucades fan servir Daily.co amb xifratge en trànsit i sales privades: només hi entra qui té accés a la consulta.',
    invoiceT: 'Pagaments amb Stripe i factura', invoiceD: 'Els cobraments els processa Stripe i cada retirada del metge es justifica amb la seva factura (CFDI) al seu RFC.',
  },
  ss: { storiesTitle: 'Casos reals, amb permís', storiesBody: 'Estem documentant els primers casos de metges a la plataforma. Els publicarem amb el seu nom i la seva autorització; mentrestant, això és el que pots comprovar.' },
  fd: {
    subtitle: 'Fes consultes en línia, emet lives i cobra des d’un sol lloc, amb la teva cèdula verificada.',
    pricingTitle: 'Quant cobres i quant reps', pricingSub: 'Tu poses el preu. Aquestes són les condicions vigents de la plataforma.',
    commission: '{pct} % de comissió', commissionD: 'Per cada consulta, xat, live o gravació que cobres, tu reps el {rest} %.',
    example: 'Exemple: cobres {fee} → reps {net}', payout: 'Retirada setmanal des de {min}', payoutD: 'Es diposita al teu compte bancari, amb la teva factura (CFDI).',
    wallet: 'Recàrrega mínima de {min}', walletD: 'El mínim que es pot carregar al moneder per pagar a la plataforma.',
    market: 'Marketplace mèdic: {pct} %', marketD: 'Comissió per cada venda de productes o equips al marketplace.',
  },
  em: {
    safetyTitle: 'És una emergència?', safetyBody: 'Si tu o algú altre esteu en perill, no esperis una videoconsulta: truca al 911 o ves a urgències.',
    call911: 'Truca al 911', lineaVida: 'Línea de la Vida: 800 911 2000', lineaVidaD: 'Gratuïta i 24 hores: suport en crisis emocionals, idees suïcides i addiccions.',
    emptyTitle: 'Ara mateix no hi ha metges disponibles', emptyBody: 'Torna-ho a provar més tard o busca al directori. Si és urgent, truca al 911.', directory: 'Veure el directori mèdic',
  },
};

const zh: DeepPartial<Dict> = {
  fp: { network: '各专科执业证已验证的医生，资料与资质公开可查。' },
  res: { heroSub: '加入住院医师学术社区。学习、协作，实现职业成长。', ctaSub: '立即注册，开始与其他住院医师和经过验证的医生交流。' },
  wl: {
    badge: '患者：即将开放', cta: '加入候补名单', title: '患者：即将开放',
    body: '目前 Medical Masters 仅向医生和住院医师开放。留下您的邮箱，患者账户开放时我们会第一时间通知您。',
    profileNote: '面向患者的问诊、聊天和订阅即将开放。',
    name: '姓名', email: '电子邮箱', interest: '您感兴趣的专科？（可选）',
    submit: '通知我', sending: '发送中…', done: '完成！您已加入名单',
    doneBody: '患者账户开放时，我们会发邮件到这个地址。',
    error: '无法保存，请稍后再试。', invalid: '请填写姓名和有效的邮箱。',
    privacy: '您的邮箱只用于通知开放消息。', doctorQ: '您是医生？创建账户', close: '关闭',
  },
  live: { upcomingBadge: '即将直播', upcomingShort: '即将直播', soon: '即将开放' },
  hero: { languages: '8 种语言', verified: '执业证已验证' },
  trust: {
    title: '您可以核实的内容', subtitle: '没有夸大的数字：这是平台目前的运作方式。',
    cedulaT: '执业证书已验证', cedulaD: '每位医生都需登记执业证书（cédula），团队会在墨西哥国家专业人员登记处（SEP）核实后才批准其资料。',
    cofeprisT: 'COFEPRIS 许可已审核', cofeprisD: '医生上传 COFEPRIS 许可后，团队会先审核再显示在其资料中。',
    dailyT: '加密视频问诊', dailyD: '视频通话使用 Daily.co，传输加密并使用私密房间：只有有权参加问诊的人才能进入。',
    invoiceT: 'Stripe 支付与发票', invoiceD: '付款由 Stripe 处理，医生的每笔提现都以其税务发票（CFDI，RFC）为凭证。',
  },
  ss: { storiesTitle: '真实案例，经本人同意', storiesBody: '我们正在整理平台上第一批医生的案例，将在获得本人同意后署名发布；在此之前，以下是您可以核实的内容。' },
  fd: {
    subtitle: '在一个地方进行在线问诊、直播和收款，执业证经过验证。',
    pricingTitle: '您的收费与实际收入', pricingSub: '价格由您决定。以下是平台当前的条件。',
    commission: '{pct}% 佣金', commissionD: '您收费的每次问诊、聊天、直播或录像，您可获得 {rest}%。',
    example: '示例：您收费 {fee} → 您收到 {net}', payout: '每周提现，最低 {min}', payoutD: '存入您的银行账户，需附税务发票（CFDI）。',
    wallet: '最低充值 {min}', walletD: '在平台付款时钱包可充值的最低金额。',
    market: '医疗商城：{pct}%', marketD: '商城中每笔产品或设备销售的佣金。',
  },
  em: {
    safetyTitle: '是紧急情况吗？', safetyBody: '如果您或他人有危险，请不要等待视频问诊：立即拨打 911 或前往急诊。',
    call911: '拨打 911', lineaVida: 'Línea de la Vida：800 911 2000', lineaVidaD: '免费、24 小时：情绪危机、自杀念头和成瘾支持。',
    emptyTitle: '目前没有可接诊的医生', emptyBody: '请稍后再试或在医生目录中查找。如情况紧急，请拨打 911。', directory: '查看医生目录',
  },
};

const DICTS: Record<string, DeepPartial<Dict>> = { es, en, pt, fr, it, de, ca, zh };

function lookup(dict: unknown, path: string): string | undefined {
  let o: unknown = dict;
  for (const k of path.split('.')) {
    if (o && typeof o === 'object' && k in (o as Record<string, unknown>)) o = (o as Record<string, unknown>)[k];
    else return undefined;
  }
  return typeof o === 'string' ? o : undefined;
}

export type CT = (key: string, vars?: Record<string, string | number>) => string;

export function useCoherenceText(): CT {
  const { language } = useLanguage();
  const dict = DICTS[language] ?? es;
  return (key, vars) => {
    let s = lookup(dict, key) ?? lookup(es, key) ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}
