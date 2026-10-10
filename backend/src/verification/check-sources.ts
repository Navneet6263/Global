/**
 * Standard source lists printed in the database, directorship and media annexures
 * (Sample Report: "India Specific and Global Database Check Including OFAC").
 * Every source is searched for every candidate; the verifier records one result per
 * group and any match in the remarks.
 */
export const INDIA_DATABASES: readonly string[] = [
  "Central Bureau of Investigation (CBI) Most Wanted List",
  "Central Vigilance Commission Database",
  "Supreme Court & High Court Records including Tribunals, Commissions and Ordinances",
  "Reserve Bank of India's Loan Defaulters List",
  "Securities and Exchange Board of India (SEBI) Database",
  "Government of India - National Informatics Center Database Search",
  "India Ministry of Home Affairs - Banned Terrorist Organizations",
];

export const GLOBAL_SANCTIONS_NOTE =
  "This database contains details of companies and individuals who have been sanctioned by regulatory or compliance authorities for regulatory breaches, as well as individuals and entities appearing on government-prohibited persons lists, including terrorists, international narcotics traffickers, and persons or entities involved in activities related to the proliferation of weapons of mass destruction. The database is compiled from information provided by various international regulatory and government authorities.";

export const GLOBAL_SANCTIONS: ReadonlyArray<{
  region: string;
  sources: readonly string[];
}> = [
  {
    region: "Australia",
    sources: [
      "Australian Prudential Regulation Authority",
      "Australian Securities & Investments Commission",
      "Implementation of UN Country Embargo",
      "Iran Specified Entities List",
      "Australian Department of Foreign Affairs & Trade",
      "Independent Commission Against Corruption",
      "Reserve Bank of Australia",
    ],
  },
  {
    region: "Austria",
    sources: [
      "Oesterreichische National Bank- Terrorism List",
      "Financial Market Authority",
    ],
  },
  {
    region: "Bahamas",
    sources: ["Central Bank of Bahamas - Warning Notices"],
  },
  {
    region: "Belgium",
    sources: ["Commission Bancaire Et Financiere"],
  },
  {
    region: "Brazil",
    sources: ["Departamento De Investigacoes Sobre Narcoticos"],
  },
  {
    region: "Canada",
    sources: [
      "Country Embargo Listed By Canadian Authorities",
      "Special Economic Measures (Iran)",
      "Special Economic Measures (Burma)",
      "Special Economic Measures (Zimbabwe)",
      "Canadian Criminal Code",
      "Canadian Economic Sanctions",
      "Combined Forces Special Enforcement Units",
      "Canadian Securities Administrators - Cease Trade Orders",
      "Investment Dealers Association of Canada",
      "Investment Industry Regulatory Organization Of Canada",
      "Office of the Superintendent of Financial Institutions",
      "Wanted By Royal Canadian Mounted Police",
      "Securities Exchange Commission of British Columbia",
      "Canadian Un Sanctions Against Terrorism",
    ],
  },
  {
    region: "Cayman Islands",
    sources: ["Cayman Islands Monetary Authority"],
  },
  {
    region: "China",
    sources: [
      "China Securities Regulatory Commission",
      "People's Bank of China - United Nations Sanctions",
      "People's Bank of China - Eastern Turkistan Islamic Movement",
    ],
  },
  {
    region: "Cyprus",
    sources: [
      "Cyprus Securities & Exchange Commission - Warnings To Investors",
    ],
  },
  {
    region: "Czech Republic",
    sources: ["Czech Securities Commission"],
  },
  {
    region: "Dominica",
    sources: ["Ministry of Finance"],
  },
  {
    region: "European Union",
    sources: [
      "European Union Sanctions",
      "European Union - Airline Blacklist",
      "European Union - Advisory Notice",
      "European Union - Asset Freeze Al Qaida / Taliban - 2002/402/CFSP, EC 881/2002",
      "European Union - Country Embargo",
      "European Union - Prohibiting Trade With Myanmar Logging, Timber & Mining Enterprises - 2006/318/CFSP Amended - Annex 1",
      "European Union - Travel Ban",
      "European Union - Asset Freeze Belarus - 2006/362/CFSP, Ec 765/2006",
      "European Union - Travel Ban Belarus - 2006/276/CFSP, Ec765/2006",
      "European Union - Asset Freeze Cote D'lvoire - 2004/852/CFSP Ec 560/2005",
      "European Union - Asset Freeze Dem. Rep. Congo - 2005/440/CFSP, Ec 889/2005",
      "European Union - Asset Freeze Dem. Rep. of Korea - Ec 329/2007",
      "European Union - Asset Freeze Republic of Guinea - 2009/788/CFSP, Eu1284/2009",
      "European Union - Asset Freeze Frysm - 2000/696/CFSP, Ec 2488/2000",
      "European Union - Asset Freeze Icty - 2004/694/CFSP, Ec 1763/2004",
      "European Union - Asset Freeze Iran - 2007/140/CFSP, Ec 423/2007",
      "European Union - Asset Freeze Iraq - 2003/495/CFSP, Ec 1210/2003",
      "European Union - Asset Freeze Liberia - 2004/487/CFSP, Ec 872/2004",
      "European Union - Asset Freeze Somalia - 2009/138/CFSP, Ec 365/2010",
      "European Union - Travel Ban Republic of Guinea - 2009/788/CFSP",
      "European Union - Travel Ban Frysm - 2000/696/CFSP, Ec 2488/2000",
      "European Union - Travel Ban Fyrom - 2004/133/CFSP",
      "European Union - Travel Ban Icty - 2004/293/CFSP",
      "European Union - Travel Ban Moldova - 2004/179/CFSP",
      "European Union - Travel Ban Myanmar - 2004/423/CFSP, Ec 817/2006",
      "European Union - Terror Asset Freeze - 2001/931/CFSP, Ec 2580/2001",
      "European Union - Travel Ban Zimbabwe - 2002/145/CFSP, Ec 314/2004",
      "European Union - Terror Co-Operation - 2001/931/CFSP",
      "European Union - Financial Restrictions Myanmar - 2004/423/CFSP,Ec817/2006",
      "European Union - Asset Freeze Sudan - 2005/411/CFSP, Ec 1184/2005",
      "European Union - Asset Freeze Zimbabwe - 2002/145/CFSP, Ec 314/2004",
    ],
  },
  {
    region: "France",
    sources: ["Ministere De L-economie, Des Finances Et De L'industrie"],
  },
  {
    region: "Germany",
    sources: [
      "Bundesanstalt Fur Finanzdienstleistungsaufsicht",
      "Deutsche Bundesbank",
    ],
  },
  {
    region: "Gibraltar",
    sources: ["Gibraltar Financial Services Commission"],
  },
  {
    region: "Guernsey",
    sources: ["Guernsey Financial services Commission"],
  },
  {
    region: "Hong Kong",
    sources: [
      "Hong Kong Special Administrative Region Gazette",
      "Hong Kong Monetary Authority",
      "Hong Kong Monetary Authority - Warning Notices",
      "Hong Kong Securities & Futures Commission",
      "Hong Kong Securities & Futures Commission - Investor Alert",
      "Independent Commission Against Corruption",
    ],
  },
  {
    region: "International",
    sources: [
      "Embargoed Country Maritime Vessel",
      "Embargoed Country - Port",
      "Interpol - International Police Organization",
    ],
  },
  {
    region: "Ireland",
    sources: [
      "Central Bank of Ireland",
      "Receiver of Revenue",
      "Irish Financial Services Regulatory Authority",
    ],
  },
  {
    region: "Israel",
    sources: [
      "Israel Ministry of Defense - Terrorism List",
      "Israel Antitrust Authority",
    ],
  },
  {
    region: "Italy",
    sources: ["National Commission Borsa"],
  },
  {
    region: "Japan",
    sources: [
      "Japan Financial Intelligence Office",
      "Japan Ministry of Finance - All International Sanctions",
      "Japan Ministry of Economy, Trade & Industry - WMD End User List",
      "Japan National Police Agency - Designated Boryokudan",
    ],
  },
  {
    region: "Jersey",
    sources: [
      "States of Jersey - Sanctions Orders",
      "Jersey Financial Services Commission",
    ],
  },
  {
    region: "South Korea",
    sources: [
      "Korea, South - Financial Intelligence Unit - Kofiu",
      "Korea, South - Ministry of Strategy and Finance - Sanctions",
    ],
  },
  {
    region: "Liechtenstein",
    sources: ["Liechtensteinisches Landesgesetzblatt"],
  },
  {
    region: "Luxembourg",
    sources: ["Commission De Surveillance Du Secteur Financier"],
  },
  {
    region: "Malaysia",
    sources: ["Malaysia Securities Commission"],
  },
  {
    region: "Malta",
    sources: [
      "Malta Financial Services Authority",
      "Malta Financial Services Authority - Sanctions",
    ],
  },
  {
    region: "Monaco",
    sources: ["Min. Of State - Fin. Information & Control Service"],
  },
  {
    region: "Netherlands",
    sources: ["Autoriteit Financiele Markten"],
  },
  {
    region: "Netherlands Antilles",
    sources: ["Bank Van De Nederlandse Antillen - Warning Notices"],
  },
  {
    region: "New Zealand",
    sources: [
      "New Zealand Ministry of Consumer Affairs",
      "New Zealand Ministry Foreign Affairs & Trade - UNSC Sanctions",
      "New Zealand Police - Designated Terrorists",
      "New Zealand - Terrorism Suppression Act - Designated Terrorist",
      "Reserve Bank of New Zealand",
      "Securities & Exchange Commission New Zealand",
      "Serious Fraud Office - New Zealand",
    ],
  },
  {
    region: "Organization for Economic Co-Operation and Development",
    sources: ["Non Co-Operative Countries & Territories"],
  },
  {
    region: "Pakistan",
    sources: ["National Accountability Bureau"],
  },
  {
    region: "Philippines",
    sources: ["Philippines Securities and Exchange Commission"],
  },
  {
    region: "Singapore",
    sources: [
      "Commercial Affairs Department - Prosecutions",
      "Monetary Authority of Singapore",
      "Monetary Authority of Singapore - Enforcement",
      "Monetary Authority of Singapore - Warning Notices",
    ],
  },
  {
    region: "South Africa",
    sources: ["South African Competitions Commission"],
  },
  {
    region: "Spain",
    sources: ["Comision Nacional Del Mercado De Valores"],
  },
  {
    region: "Sweden",
    sources: ["Finansinspektionen"],
  },
  {
    region: "Switzerland",
    sources: [
      "Federal Banking Commission (Money Laundering Control Authority) - Bush Lists (New List - B/110)",
      "Swiss Financial Market Supervisory Authority",
      "State Secretariat For Economic Affairs",
      "State Secretariat For Economic Affairs - Al Qaida & Taliban",
      "State Secretariat For Economic Affairs - Belarus Asset Freeze",
      "State Secretariat For Economic Affairs - Belarus Travel Ban",
      "State Secretariat For Economic Affairs - Cote D'lvoire",
      "State Secretariat For Economic Affairs - Dem. Rep. Congo",
      "State Secretariat For Economic Affairs - Dem. People's Rep. of Korea",
      "State Secretariat For Economic Affairs - Guinea Asset Freeze",
      "State Secretariat For Economic Affairs - Guinea Travel Ban",
      "State Secretariat For Economic Affairs - Iran",
      "State Secretariat For Economic Affairs - Iraq",
      "State Secretariat For Economic Affairs - Yugoslavia",
      "State Secretariat For Economic Affairs - Liberia Asset Freeze",
      "State Secretariat For Economic Affairs - Liberia Travel Ban",
      "State Secretariat For Economic Affairs - Myanmar",
      "State Secretariat For Economic Affairs - Sudan",
      "State Secretariat For Economic Affairs - Somalia",
      "State Secretariat For Economic Affairs - Zimbabwe",
      "State Secretariat For Economic Affairs - Country Embargo",
    ],
  },
  {
    region: "Taiwan",
    sources: [
      "Ministry Of Justice - Investigation Bureau",
      "Taiwan - Financial Supervisory Commission",
    ],
  },
  {
    region: "Thailand",
    sources: ["Securities Exchange Commission Thailand"],
  },
  {
    region: "Ukraine",
    sources: [
      "State Committee For Financial Monitoring - UN Sanctions Programmes",
      "State Committee For Financial Monitoring - Terrorism List",
    ],
  },
  {
    region: "United Kingdom",
    sources: [
      "British Banker's Association - Tag List (Temporary Keyword)",
      "Companies House",
      "Dept Trade & Industry - Strategic Export Control Wmd End Use Control - Iran",
      "Financial Services Authority",
      "Financial Services Authority - List of Unauthorised Internet Banks",
      "Financial Services Authority - List of Unauthorised Firms or Individuals",
      "Financial Services Authority - List of Unauthorised Overseas Firms",
      "Isle of Man Financial Supervision Commission",
      "Isle of Man Financial Supervision Commission - Dissolved Company",
      "Isle of Man Financial Supervision Commission - Struck off Company",
      "Isle of Man Sanctions Orders & Financial Restrictions",
      "UK Metropolitan Police Force",
      "Serious Fraud Office",
      "Serious and Organised Crime Agency",
      "HM Treasury",
      "HM Treasury Advisory Notice",
      "HM Treasury Financial Restrictions",
      "HM Treasury Investment Ban",
      "HM Customs & Excise",
      "HM Home Office",
    ],
  },
  {
    region: "United Nations",
    sources: [
      "United Nations Sanctions",
      "United Nations Sanctions - Iran Non Proliferation UNSCR 1737 (Including UN1747 and UN 1803)",
      "United Nations UN Res. 1267 - Al Qaida & Taliban",
      "United Nations UN Res. - 1572 - Cote - D'lvoire",
      "United Nations UN Res. - 1612 - Children In Armed Conflict",
      "United Nations UN Res. - 1533 - Democratic Republic of the Congo",
      "United Nations UN Res. - 1718 - Democratic People's Republic of Korea",
      "United nations Country Sanctions",
      "United Nations - Iraq UN Res. 1483 & 1518",
      "United Nations Sanctions - Liberia. UN Res. 1532 (2004)",
      "United Nations Sanctions - Sudan UNSCR 1591",
      "United Nations Sanctions - Somalia & Eritrea UN Res 751 (1992) & 1907 (2009)",
      "United Nations Travel Ban",
      "United Nations Travel Ban - Liberia UN Res 1521 (2003)",
    ],
  },
  {
    region: "Uruguay",
    sources: [
      "Central Bank of Uruguay - Account Closures",
      "Central Bank Of Uruguay - Pep List",
    ],
  },
  {
    region: "United States of America",
    sources: [
      "Arizona Department of Insurance",
      "Bureau of International Security & Nonproliferation Sanctions - Under Executive order No. 12938",
      "Bureau of International Security & Nonproliferation Sanctions - Under Executive order No. 13382",
      "Bureau of International Security & Nonproliferation Sanctions - Iran / Iraq Arms Act of 1992",
      "Bureau of International Security & Nonproliferation Sanctions - Missiles",
      "Bureau of International Security & Nonproliferation Sanctions - Chemical & Biological Weapons",
      "Bureau of International Security & Nonproliferation Sanctions - Transfer of Lethal Military Equipment",
      "Bureau of International Security & Nonproliferation Sanctions - Iran Act of 2000",
      "Bureau of International Security & Nonproliferation Sanctions - Iran Syria",
      "OFAC List - Blocked Pending Investigation",
      "OFAC List - Blocked Pending Investigation - Bpi - Pa",
      "OFAC List - Blocked Pending Investigation - Bpi - Sdnt",
      "OFAC List - Blocked Pending Investigation - Bpi - Sdntk",
      "Bureau of Industry & Security Fka Bureau of Export Administration - Denied Persons List",
      "Bureau of Industry & Security Fka Bureau of Export Administration - Entity List",
      "Bureau of Industry & Security Fka Bureau of Export Administration - Unverified list",
      "Commodity Futures Trading Commission",
      "US Department of Treasury - OFAC Civil Penalties",
      "Bureau of Industry & Security - Export Admin Regs - General Order 3 Part 736",
      "Excluded Parties Listing System",
      "FBI - Federal Bureau of Investigation",
      "Federal Deposit Insurance Corporation",
      "Federal Deposit Insurance Corporation - Failed Banks",
      "Financial Industry Regulatory Authority",
      "OFAC SDN List - Foreign Terrorist Organisation",
      "Us Department of Health & Human Services",
      "US Immigration & Customs Enforcement",
      "OFAC SDN List - Iran Financial Sanctions Regulation",
      "Bureau of Verification, Compliance, and Implementation - Iran, North Korea and Syria Nonproliferation Sanctions.",
      "OFAC SDN List - Iran Human Rights",
      "OFAC SDN List - Iraq 2",
      "National Memorial Institute For the Prevention of Terrorism",
      "National Futures Association",
      "OFAC Brochure - Non Proliferation of Weapons of Mass Destruction",
      "OFAC SDN List - Non - Proliferation of Weapons of Mass Destruction",
      "OFAC - Palestinian Legislative Council List",
      "New York State Banking Board",
      "New York State Insurance Department",
      "New York Stock Exchange",
      "Comptroller of Currency - Administrator of National Banks",
      "Comptroller of Currency - Enforcement Actions",
      "Office of Foreign Assets Control",
      "OFAC SDN List - Balkans",
      "OFAC SDN List - Belarus",
      "OFAC SDN List - Burma",
      "OFAC SDN List - Cuba",
      "OFAC SDN List - Cote D'lvoire",
      "OFAC SDN List - Darfur",
      "OFAC SDN List - Dem. People's Rep. of Korea",
      "OFAC SDN List - Dem. Rep. of the Congo",
      "OFAC SDN List - Iran",
      "OFAC SDN List - Iraq",
      "OFAC SDN List - Lebanon",
      "OFAC SDN List - Liberia",
      "OFAC SDN List - North Korea",
      "OFAC SDN List - Sudan",
      "OFAC SDN List - Somalia",
      "OFAC SDN List - Syria",
      "OFAC SDN List - Zimbabwe",
      "Office of Thrift Supervision",
      "Pennsylvania Department General Services",
      "OFAC List - Specially Designated Global Terrorist",
      "OFAC List - Specially Designated Narcotics Trafficker",
      "OFAC List - Specially Designated Narcotics Trafficker Kingpin",
      "OFAC List - Specially Designated Terrorist",
      "US State Department - Terrorist Exclusion List",
      "Securities Exchange Commission",
      "Securities Exchange Commission - Unregistered Soliciting Entities",
      "US Marshals",
      "US Drug Enforcement Administration",
      "US Department of Justice",
      "US Department of Labor, Employee Benefits Security Administration",
      "US Department of Labor, Office of Labor - management Standards",
      "US Defense Trade Controls",
      "US Defense Trade Controls - Consent Agreements",
      "US Country Sanctions",
      "US Federal Reserve Board",
      "No Record Found US National Credit Union Administration",
      "US Postal Inspection Service",
      "US Department of Treasury - Keyword Currently Inactive",
      "US Treasury - Us Patriot Act Section 311",
      "Wisconsin Department of Transportation",
      "OFAC SDN List - Iraq 3 - Islamic Revolutionary Guard Corp.",
    ],
  },
  {
    region: "World Bank",
    sources: ["World Bank"],
  },
];

export const DIRECTORSHIP_DATABASES: ReadonlyArray<{
  key: string;
  name: string;
  detail: string;
}> = [
  {
    key: "watchList",
    name: "Directorship Watch List",
    detail:
      "Directors disqualified by the Ministry of Corporate Affairs and companies struck off or under prosecution.",
  },
  {
    key: "crossDirectorships",
    name: "Cross Directorships Database",
    detail:
      "Through a variety of databases, cross-check for directorships in over 260,000 companies incorporated in India.",
  },
  {
    key: "pepDatabase",
    name: "Indian Politically Exposed Persons (PEP) Database",
    detail:
      "Individuals who perform public functions for a government or administrative body, influential people in religious organisations with a sphere of influence over political, military or judicial matters, persons who formerly held these positions, and their family members and associates.",
  },
];

export const MEDIA_SEARCH_NOTE =
  "The web and media searches include global news and articles from over 9,000 authoritative sources and websites, identifying individuals and entities associated with crimes of any nature such as civil, criminal, corruption, money laundering, serious and organised crime and terrorism. The sources go back up to 25 years and also cover local-language articles.";
