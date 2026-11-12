/** Company details printed in the report footer and in every email footer. */
export const COMPANY_FOOTER = {
  name: "Sapling Global Assurance Private Limited",
  office: "A-43 SECTOR 67 NOIDA 201301",
  cin: "U74999UP2020PTC125447",
  email: "reachus@saplingglobal.com",
  web: "www.saplingglobal.com",
};

/** The seller block, bank details and SAC code of the tax invoice (Sample Invoice Format). */
export const INVOICE_SELLER = {
  name: "Sapling Global Assurance Private Limited",
  address: [
    "A-43, Sector 67, Noida, Noida,",
    "Gautambuddha Nagar, Uttar Pradesh,",
  ],
  gstin: "09ABDCS2128Q1ZV",
  stateName: "Uttar Pradesh",
  stateCode: "09",
  email: "Saplingglobal2020@gmail.com",
  bank: {
    name: "ICICI BANK - 003105038065",
    account: "003105038065",
    branchAndIfsc: "Sector 18 & ICIC0000031",
  },
  /** SAC for background verification (investigation services). Confirm with the CA. */
  sac: "998521",
};
