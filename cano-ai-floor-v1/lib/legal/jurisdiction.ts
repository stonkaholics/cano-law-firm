export type FederalJurisdiction = {
  stateCode: string | null;
  circuitId: string | null;
  circuitName: string | null;
  districtId: string | null;
  districtName: string | null;
  basis: string;
  confidence: "high" | "medium" | "low";
};

const STATE_TO_CIRCUIT: Record<string, [string, string]> = {
  AL:["ca11","Eleventh Circuit"], AK:["ca9","Ninth Circuit"],
  AZ:["ca9","Ninth Circuit"], AR:["ca8","Eighth Circuit"],
  CA:["ca9","Ninth Circuit"], CO:["ca10","Tenth Circuit"],
  CT:["ca2","Second Circuit"], DE:["ca3","Third Circuit"],
  FL:["ca11","Eleventh Circuit"], GA:["ca11","Eleventh Circuit"],
  HI:["ca9","Ninth Circuit"], ID:["ca9","Ninth Circuit"],
  IL:["ca7","Seventh Circuit"], IN:["ca7","Seventh Circuit"],
  IA:["ca8","Eighth Circuit"], KS:["ca10","Tenth Circuit"],
  KY:["ca6","Sixth Circuit"], LA:["ca5","Fifth Circuit"],
  ME:["ca1","First Circuit"], MD:["ca4","Fourth Circuit"],
  MA:["ca1","First Circuit"], MI:["ca6","Sixth Circuit"],
  MN:["ca8","Eighth Circuit"], MS:["ca5","Fifth Circuit"],
  MO:["ca8","Eighth Circuit"], MT:["ca9","Ninth Circuit"],
  NE:["ca8","Eighth Circuit"], NV:["ca9","Ninth Circuit"],
  NH:["ca1","First Circuit"], NJ:["ca3","Third Circuit"],
  NM:["ca10","Tenth Circuit"], NY:["ca2","Second Circuit"],
  NC:["ca4","Fourth Circuit"], ND:["ca8","Eighth Circuit"],
  OH:["ca6","Sixth Circuit"], OK:["ca10","Tenth Circuit"],
  OR:["ca9","Ninth Circuit"], PA:["ca3","Third Circuit"],
  RI:["ca1","First Circuit"], SC:["ca4","Fourth Circuit"],
  SD:["ca8","Eighth Circuit"], TN:["ca6","Sixth Circuit"],
  TX:["ca5","Fifth Circuit"], UT:["ca10","Tenth Circuit"],
  VT:["ca2","Second Circuit"], VA:["ca4","Fourth Circuit"],
  WA:["ca9","Ninth Circuit"], WV:["ca4","Fourth Circuit"],
  WI:["ca7","Seventh Circuit"], WY:["ca10","Tenth Circuit"],
};

function inferState(text: string): string | null {
  const value = text.toLowerCase();
  if (/(florida|krome|baker|broward|miami|orlando)/.test(value)) return "FL";
  if (value.includes("texas")) return "TX";
  if (value.includes("california")) return "CA";
  if (value.includes("georgia")) return "GA";
  if (value.includes("new york")) return "NY";
  if (value.includes("new jersey")) return "NJ";
  if (value.includes("pennsylvania")) return "PA";
  if (value.includes("arizona")) return "AZ";
  return null;
}

export function resolveFederalJurisdiction(input: unknown): FederalJurisdiction {
  const text = JSON.stringify(input || {}).toLowerCase();

  if (text.includes("krome")) {
    return {
      stateCode:"FL", circuitId:"ca11", circuitName:"Eleventh Circuit",
      districtId:"flsd", districtName:"Southern District of Florida",
      basis:"Krome detention location detected in the matter record.",
      confidence:"high"
    };
  }

  if (text.includes("broward")) {
    return {
      stateCode:"FL", circuitId:"ca11", circuitName:"Eleventh Circuit",
      districtId:"flsd", districtName:"Southern District of Florida",
      basis:"Broward detention location detected in the matter record.",
      confidence:"high"
    };
  }

  if (text.includes("baker")) {
    return {
      stateCode:"FL", circuitId:"ca11", circuitName:"Eleventh Circuit",
      districtId:"flmd", districtName:"Middle District of Florida",
      basis:"Baker County detention location detected in the matter record.",
      confidence:"high"
    };
  }

  if (text.includes("orlando")) {
    return {
      stateCode:"FL", circuitId:"ca11", circuitName:"Eleventh Circuit",
      districtId:"flmd", districtName:"Middle District of Florida",
      basis:"Orlando location detected in the matter record.",
      confidence:"high"
    };
  }

  const stateCode = inferState(text);
  if (stateCode && STATE_TO_CIRCUIT[stateCode]) {
    const [circuitId, circuitName] = STATE_TO_CIRCUIT[stateCode];
    return {
      stateCode, circuitId, circuitName,
      districtId:null, districtName:null,
      basis:"Circuit inferred from the state/location in the supplied matter. Exact federal district requires facility/county confirmation.",
      confidence:"medium"
    };
  }

  return {
    stateCode:null, circuitId:null, circuitName:null,
    districtId:null, districtName:null,
    basis:"No reliable detention state/district could be resolved from the supplied matter.",
    confidence:"low"
  };
}
