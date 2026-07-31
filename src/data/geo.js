/**
 * Geographic reference for the Country → State → City cascade on the account form.
 * India is covered in full (states + UTs with their major cities); the other
 * countries are the ones in the real book plus common ones, with their key cities.
 * Every dropdown also offers "Other…" so anything missing can be typed in.
 *
 * Shape: { Country: { State/Province: [City, …] } }. Sorted for display at build.
 */
export const GEO = {
    India: {
        'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kakinada', 'Rajahmundry'],
        'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
        'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tezpur'],
        'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia'],
        'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'],
        'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
        'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Anand'],
        'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal', 'Rohtak'],
        'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Manali'],
        'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
        'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davanagere'],
        'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Kottayam'],
        'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa'],
        'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Navi Mumbai', 'Solapur', 'Kolhapur'],
        'Manipur': ['Imphal', 'Thoubal'],
        'Meghalaya': ['Shillong', 'Tura'],
        'Mizoram': ['Aizawl', 'Lunglei'],
        'Nagaland': ['Kohima', 'Dimapur'],
        'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'],
        'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'],
        'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar'],
        'Sikkim': ['Gangtok', 'Namchi'],
        'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'],
        'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
        'Tripura': ['Agartala', 'Udaipur'],
        'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Noida', 'Bareilly'],
        'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh'],
        'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman'],
        'Andaman and Nicobar Islands': ['Port Blair'],
        'Chandigarh': ['Chandigarh'],
        'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Silvassa', 'Diu'],
        'Delhi': ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket'],
        'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
        'Ladakh': ['Leh', 'Kargil'],
        'Lakshadweep': ['Kavaratti'],
        'Puducherry': ['Puducherry', 'Karaikal']
    },
    'United Arab Emirates': {
        'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
        'Dubai': ['Dubai'],
        'Sharjah': ['Sharjah'],
        'Ajman': ['Ajman'],
        'Ras Al Khaimah': ['Ras Al Khaimah'],
        'Fujairah': ['Fujairah'],
        'Umm Al Quwain': ['Umm Al Quwain']
    },
    Singapore: { Singapore: ['Singapore'] },
    Philippines: {
        'Metro Manila': ['Manila', 'Quezon City', 'Makati', 'Taguig', 'Pasig'],
        'Central Visayas': ['Cebu City', 'Mandaue'],
        'Davao Region': ['Davao City']
    },
    'United States': {
        California: ['San Francisco', 'Los Angeles', 'San Jose', 'San Diego', 'Palo Alto'],
        'New York': ['New York City', 'Buffalo', 'Albany'],
        Texas: ['Austin', 'Dallas', 'Houston', 'San Antonio'],
        Washington: ['Seattle', 'Redmond', 'Bellevue'],
        Massachusetts: ['Boston', 'Cambridge'],
        Illinois: ['Chicago'],
        Georgia: ['Atlanta']
    },
    'United Kingdom': {
        England: ['London', 'Manchester', 'Birmingham', 'Bristol', 'Leeds', 'Cambridge'],
        Scotland: ['Edinburgh', 'Glasgow'],
        Wales: ['Cardiff'],
        'Northern Ireland': ['Belfast']
    },
    Singapore_: {}, // placeholder removed at build (kept object valid) — ignore
    Australia: {
        'New South Wales': ['Sydney', 'Newcastle'],
        Victoria: ['Melbourne', 'Geelong'],
        Queensland: ['Brisbane', 'Gold Coast'],
        'Western Australia': ['Perth']
    },
    Germany: {
        Bavaria: ['Munich', 'Nuremberg'],
        Berlin: ['Berlin'],
        Hesse: ['Frankfurt'],
        Hamburg: ['Hamburg']
    },
    Canada: {
        Ontario: ['Toronto', 'Ottawa'],
        Quebec: ['Montreal', 'Quebec City'],
        'British Columbia': ['Vancouver']
    },
    'Saudi Arabia': {
        Riyadh: ['Riyadh'],
        Makkah: ['Jeddah', 'Mecca'],
        'Eastern Province': ['Dammam', 'Khobar']
    }
};

// Clean up the placeholder key so it never renders.
delete GEO.Singapore_;

export const COUNTRIES = Object.keys(GEO).sort((a, b) => (a === 'India' ? -1 : b === 'India' ? 1 : a.localeCompare(b)));
export const statesOf = (country) => (GEO[country] ? Object.keys(GEO[country]).sort() : []);
export const citiesOf = (country, state) => (GEO[country]?.[state] ? [...GEO[country][state]].sort() : []);
