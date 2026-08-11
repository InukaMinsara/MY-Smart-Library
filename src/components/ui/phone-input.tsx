import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const COUNTRY_CODES = [
  { code: "+93", country: "Afghanistan", iso: "AF" },
  { code: "+355", country: "Albania", iso: "AL" },
  { code: "+213", country: "Algeria", iso: "DZ" },
  { code: "+376", country: "Andorra", iso: "AD" },
  { code: "+244", country: "Angola", iso: "AO" },
  { code: "+54", country: "Argentina", iso: "AR" },
  { code: "+374", country: "Armenia", iso: "AM" },
  { code: "+61", country: "Australia", iso: "AU" },
  { code: "+43", country: "Austria", iso: "AT" },
  { code: "+994", country: "Azerbaijan", iso: "AZ" },
  { code: "+973", country: "Bahrain", iso: "BH" },
  { code: "+880", country: "Bangladesh", iso: "BD" },
  { code: "+375", country: "Belarus", iso: "BY" },
  { code: "+32", country: "Belgium", iso: "BE" },
  { code: "+501", country: "Belize", iso: "BZ" },
  { code: "+229", country: "Benin", iso: "BJ" },
  { code: "+975", country: "Bhutan", iso: "BT" },
  { code: "+591", country: "Bolivia", iso: "BO" },
  { code: "+387", country: "Bosnia and Herzegovina", iso: "BA" },
  { code: "+267", country: "Botswana", iso: "BW" },
  { code: "+55", country: "Brazil", iso: "BR" },
  { code: "+673", country: "Brunei", iso: "BN" },
  { code: "+359", country: "Bulgaria", iso: "BG" },
  { code: "+226", country: "Burkina Faso", iso: "BF" },
  { code: "+257", country: "Burundi", iso: "BI" },
  { code: "+238", country: "Cape Verde", iso: "CV" },
  { code: "+855", country: "Cambodia", iso: "KH" },
  { code: "+237", country: "Cameroon", iso: "CM" },
  { code: "+1", country: "Canada", iso: "CA" },
  { code: "+236", country: "Central African Republic", iso: "CF" },
  { code: "+235", country: "Chad", iso: "TD" },
  { code: "+56", country: "Chile", iso: "CL" },
  { code: "+86", country: "China", iso: "CN" },
  { code: "+57", country: "Colombia", iso: "CO" },
  { code: "+269", country: "Comoros", iso: "KM" },
  { code: "+243", country: "Congo (DRC)", iso: "CD" },
  { code: "+242", country: "Congo (Republic)", iso: "CG" },
  { code: "+506", country: "Costa Rica", iso: "CR" },
  { code: "+385", country: "Croatia", iso: "HR" },
  { code: "+53", country: "Cuba", iso: "CU" },
  { code: "+357", country: "Cyprus", iso: "CY" },
  { code: "+420", country: "Czech Republic", iso: "CZ" },
  { code: "+45", country: "Denmark", iso: "DK" },
  { code: "+253", country: "Djibouti", iso: "DJ" },
  { code: "+1-809", country: "Dominican Republic", iso: "DO" },
  { code: "+593", country: "Ecuador", iso: "EC" },
  { code: "+20", country: "Egypt", iso: "EG" },
  { code: "+503", country: "El Salvador", iso: "SV" },
  { code: "+240", country: "Equatorial Guinea", iso: "GQ" },
  { code: "+291", country: "Eritrea", iso: "ER" },
  { code: "+372", country: "Estonia", iso: "EE" },
  { code: "+268", country: "Eswatini", iso: "SZ" },
  { code: "+251", country: "Ethiopia", iso: "ET" },
  { code: "+679", country: "Fiji", iso: "FJ" },
  { code: "+358", country: "Finland", iso: "FI" },
  { code: "+33", country: "France", iso: "FR" },
  { code: "+241", country: "Gabon", iso: "GA" },
  { code: "+220", country: "Gambia", iso: "GM" },
  { code: "+995", country: "Georgia", iso: "GE" },
  { code: "+49", country: "Germany", iso: "DE" },
  { code: "+233", country: "Ghana", iso: "GH" },
  { code: "+30", country: "Greece", iso: "GR" },
  { code: "+502", country: "Guatemala", iso: "GT" },
  { code: "+224", country: "Guinea", iso: "GN" },
  { code: "+245", country: "Guinea-Bissau", iso: "GW" },
  { code: "+592", country: "Guyana", iso: "GY" },
  { code: "+509", country: "Haiti", iso: "HT" },
  { code: "+504", country: "Honduras", iso: "HN" },
  { code: "+36", country: "Hungary", iso: "HU" },
  { code: "+354", country: "Iceland", iso: "IS" },
  { code: "+91", country: "India", iso: "IN" },
  { code: "+62", country: "Indonesia", iso: "ID" },
  { code: "+98", country: "Iran", iso: "IR" },
  { code: "+964", country: "Iraq", iso: "IQ" },
  { code: "+353", country: "Ireland", iso: "IE" },
  { code: "+972", country: "Israel", iso: "IL" },
  { code: "+39", country: "Italy", iso: "IT" },
  { code: "+225", country: "Ivory Coast", iso: "CI" },
  { code: "+1-876", country: "Jamaica", iso: "JM" },
  { code: "+81", country: "Japan", iso: "JP" },
  { code: "+962", country: "Jordan", iso: "JO" },
  { code: "+7", country: "Kazakhstan", iso: "KZ" },
  { code: "+254", country: "Kenya", iso: "KE" },
  { code: "+686", country: "Kiribati", iso: "KI" },
  { code: "+965", country: "Kuwait", iso: "KW" },
  { code: "+996", country: "Kyrgyzstan", iso: "KG" },
  { code: "+856", country: "Laos", iso: "LA" },
  { code: "+371", country: "Latvia", iso: "LV" },
  { code: "+961", country: "Lebanon", iso: "LB" },
  { code: "+266", country: "Lesotho", iso: "LS" },
  { code: "+231", country: "Liberia", iso: "LR" },
  { code: "+218", country: "Libya", iso: "LY" },
  { code: "+423", country: "Liechtenstein", iso: "LI" },
  { code: "+370", country: "Lithuania", iso: "LT" },
  { code: "+352", country: "Luxembourg", iso: "LU" },
  { code: "+261", country: "Madagascar", iso: "MG" },
  { code: "+265", country: "Malawi", iso: "MW" },
  { code: "+60", country: "Malaysia", iso: "MY" },
  { code: "+960", country: "Maldives", iso: "MV" },
  { code: "+223", country: "Mali", iso: "ML" },
  { code: "+356", country: "Malta", iso: "MT" },
  { code: "+222", country: "Mauritania", iso: "MR" },
  { code: "+230", country: "Mauritius", iso: "MU" },
  { code: "+52", country: "Mexico", iso: "MX" },
  { code: "+691", country: "Micronesia", iso: "FM" },
  { code: "+373", country: "Moldova", iso: "MD" },
  { code: "+976", country: "Mongolia", iso: "MN" },
  { code: "+382", country: "Montenegro", iso: "ME" },
  { code: "+212", country: "Morocco", iso: "MA" },
  { code: "+258", country: "Mozambique", iso: "MZ" },
  { code: "+264", country: "Namibia", iso: "NA" },
  { code: "+977", country: "Nepal", iso: "NP" },
  { code: "+31", country: "Netherlands", iso: "NL" },
  { code: "+64", country: "New Zealand", iso: "NZ" },
  { code: "+505", country: "Nicaragua", iso: "NI" },
  { code: "+227", country: "Niger", iso: "NE" },
  { code: "+234", country: "Nigeria", iso: "NG" },
  { code: "+47", country: "Norway", iso: "NO" },
  { code: "+968", country: "Oman", iso: "OM" },
  { code: "+92", country: "Pakistan", iso: "PK" },
  { code: "+680", country: "Palau", iso: "PW" },
  { code: "+507", country: "Panama", iso: "PA" },
  { code: "+675", country: "Papua New Guinea", iso: "PG" },
  { code: "+595", country: "Paraguay", iso: "PY" },
  { code: "+51", country: "Peru", iso: "PE" },
  { code: "+63", country: "Philippines", iso: "PH" },
  { code: "+48", country: "Poland", iso: "PL" },
  { code: "+351", country: "Portugal", iso: "PT" },
  { code: "+974", country: "Qatar", iso: "QA" },
  { code: "+40", country: "Romania", iso: "RO" },
  { code: "+7", country: "Russia", iso: "RU" },
  { code: "+250", country: "Rwanda", iso: "RW" },
  { code: "+685", country: "Samoa", iso: "WS" },
  { code: "+239", country: "São Tomé and Príncipe", iso: "ST" },
  { code: "+966", country: "Saudi Arabia", iso: "SA" },
  { code: "+221", country: "Senegal", iso: "SN" },
  { code: "+381", country: "Serbia", iso: "RS" },
  { code: "+232", country: "Sierra Leone", iso: "SL" },
  { code: "+65", country: "Singapore", iso: "SG" },
  { code: "+421", country: "Slovakia", iso: "SK" },
  { code: "+386", country: "Slovenia", iso: "SI" },
  { code: "+677", country: "Solomon Islands", iso: "SB" },
  { code: "+252", country: "Somalia", iso: "SO" },
  { code: "+27", country: "South Africa", iso: "ZA" },
  { code: "+211", country: "South Sudan", iso: "SS" },
  { code: "+34", country: "Spain", iso: "ES" },
  { code: "+94", country: "Sri Lanka", iso: "LK" },
  { code: "+249", country: "Sudan", iso: "SD" },
  { code: "+597", country: "Suriname", iso: "SR" },
  { code: "+46", country: "Sweden", iso: "SE" },
  { code: "+41", country: "Switzerland", iso: "CH" },
  { code: "+963", country: "Syria", iso: "SY" },
  { code: "+886", country: "Taiwan", iso: "TW" },
  { code: "+992", country: "Tajikistan", iso: "TJ" },
  { code: "+255", country: "Tanzania", iso: "TZ" },
  { code: "+66", country: "Thailand", iso: "TH" },
  { code: "+228", country: "Togo", iso: "TG" },
  { code: "+676", country: "Tonga", iso: "TO" },
  { code: "+1-868", country: "Trinidad and Tobago", iso: "TT" },
  { code: "+216", country: "Tunisia", iso: "TN" },
  { code: "+90", country: "Turkey", iso: "TR" },
  { code: "+993", country: "Turkmenistan", iso: "TM" },
  { code: "+256", country: "Uganda", iso: "UG" },
  { code: "+380", country: "Ukraine", iso: "UA" },
  { code: "+971", country: "United Arab Emirates", iso: "AE" },
  { code: "+44", country: "United Kingdom", iso: "GB" },
  { code: "+1", country: "United States", iso: "US" },
  { code: "+598", country: "Uruguay", iso: "UY" },
  { code: "+998", country: "Uzbekistan", iso: "UZ" },
  { code: "+678", country: "Vanuatu", iso: "VU" },
  { code: "+58", country: "Venezuela", iso: "VE" },
  { code: "+84", country: "Vietnam", iso: "VN" },
  { code: "+967", country: "Yemen", iso: "YE" },
  { code: "+260", country: "Zambia", iso: "ZM" },
  { code: "+263", country: "Zimbabwe", iso: "ZW" },
];

interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, disabled, placeholder }: PhoneInputProps) {
  // Parse existing value into dial code + number
  const detected = COUNTRY_CODES.find(c => value.startsWith(c.code));
  const [selectedCountry, setSelectedCountry] = useState(
    detected ?? COUNTRY_CODES.find(c => c.iso === "LK")! // default Sri Lanka
  );
  const [localNumber, setLocalNumber] = useState(
    detected ? value.slice(detected.code.length) : value.replace(/^\+\d+/, "")
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? COUNTRY_CODES.filter(
        c =>
          c.country.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
      )
    : COUNTRY_CODES;

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value.replace(/[^\d\s\-]/g, "");
    setLocalNumber(num);
    onChange(selectedCountry.code + num.replace(/\s|-/g, ""));
  };

  const handleCountrySelect = (country: typeof COUNTRY_CODES[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch("");
    onChange(country.code + localNumber.replace(/\s|-/g, ""));
  };

  return (
    <div className="flex gap-2">
      {/* Country code picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-28 shrink-0 justify-between px-2 font-mono text-sm"
            disabled={disabled}
          >
            <span className="truncate">{selectedCountry.code}</span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              placeholder="Search country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ScrollArea className="h-64">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No country found.</p>
            ) : (
              <div className="p-1">
                {filtered.map(c => (
                  <button
                    key={c.iso + c.code}
                    type="button"
                    onClick={() => handleCountrySelect(c)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                      selectedCountry.iso === c.iso && selectedCountry.code === c.code && "bg-accent"
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{c.code}</span>
                    <span className="truncate">{c.country}</span>
                    {selectedCountry.iso === c.iso && selectedCountry.code === c.code && (
                      <Check className="ml-auto h-3 w-3 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Phone number input */}
      <Input
        type="tel"
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={placeholder ?? "77 123 4567"}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
