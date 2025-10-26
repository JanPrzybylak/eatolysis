import React, { useState } from 'react';
import axios from 'axios';
import Tesseract from 'tesseract.js';

function App() {
  const [image, setImage] = useState(null);
  const [ingredients, setIngredients] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [lang, setLang] = useState('en');
  const [searchResults, setSearchResults] = useState([]);
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);

  const badList = ['sucralose', 'aspartame', 'palm oil', 'sodium benzoate'];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    setImage(file);

    Tesseract.recognize(file, 'eng').then(({ data: { text } }) => {
      setIngredients(text);
      const found = badList.filter(item => text.toLowerCase().includes(item));
      setWarnings(found);
    });
  };
  const getIngredientText = (p, preferred) => {
    if (!p) return null;
    const specific = p[`ingredients_text_${preferred}`];
    if (specific) return specific;
    if (p.ingredients_text_en) return p.ingredients_text_en;
    if (p.ingredients_text) return p.ingredients_text;
    const keys = Object.keys(p).filter(k => k.startsWith('ingredients_text_'));
    return keys.length ? p[keys[0]] : null;
  };

  const fetchProductByCode = async (code) => {
    setLoading(true);
    try {
      const fields = 'code,product_name,ingredients_text,ingredients_text_en,ingredients_text_fr,countries,countries_tags';
      const res = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, { params: { fields } });
      const product = res.data.product;
      const text = getIngredientText(product, lang);
      if (!text) {
        setIngredients('No ingredient info found for this product.');
        setWarnings([]);
        setLoading(false);
        return;
      }
      setIngredients(text);
      setWarnings(badList.filter(item => text.toLowerCase().includes(item)));
      setSearchResults([]);
    } catch (err) {
      console.error('Error fetching product:', err);
      setIngredients('Product not found or API error.');
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query) return;
    const q = query.trim();
    setLoading(true);
    setSearchResults([]);

    try {
      // barcode -> fetch directly
      if (/^\d+$/.test(q)) {
        await fetchProductByCode(q);
        setLoading(false);
        return;
      }

      // name search -> return multiple matches for user selection
      // detect if user typed " in <country>" at end of query, remove it and use as country preference
      let explicitCountry = country && country.trim();
      const inCountryMatch = q.match(/\s+in\s+([\w\s\-]+)/i);
      let searchTerm = q;
      if (inCountryMatch) {
        explicitCountry = inCountryMatch[1].trim();
        searchTerm = q.replace(inCountryMatch[0], '').trim();
      }

      // fetch more results but display only a small subset (search through all fetched to prefer country)
      const searchRes = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
        params: { search_terms: searchTerm, search_simple: 1, action: 'process', json: 1, page_size: 100 }
      });

      let products = (searchRes.data && searchRes.data.products) ? searchRes.data.products.map(p => ({
        code: p.code,
        name: p.product_name || p.generic_name || '',
        countries: p.countries || '',
        countries_tags: p.countries_tags || []
      })) : [];

      if (products.length === 0) {
        setIngredients('No product matches found.');
        setWarnings([]);
        setLoading(false);
        return;
      }

      // If a preferred country was provided (either in the country field or appended with "in <country>"),
      // find matches across all fetched results and show up to 5, prioritizing country matches.
      const displayLimit = 5;
      if (explicitCountry) {
        const countryLower = explicitCountry.toLowerCase();
        const matches = [];
        const others = [];
        for (const p of products) {
          const countriesStr = (p.countries || '').toLowerCase();
          const tags = (p.countries_tags || []).map(t => (t || '').toLowerCase());
          const tagMatch = tags.some(t => t.includes(countryLower) || countryLower.includes(t));
          const nameMatch = countriesStr.includes(countryLower);
          if (tagMatch || nameMatch) matches.push(p); else others.push(p);
        }

        // take up to displayLimit from matches first, then fill with others
        const selected = [];
        for (let i = 0; i < matches.length && selected.length < displayLimit; i++) selected.push(matches[i]);
        for (let i = 0; i < others.length && selected.length < displayLimit; i++) selected.push(others[i]);

        setSearchResults(selected);
        setLoading(false);
        return;
      }

      // No explicit country: show only top 5 results from server
      setSearchResults(products.slice(0, displayLimit));
      setLoading(false);
      return;
    } catch (error) {
      console.error('Error searching products:', error);
      setIngredients('Product not found or API error.');
      setWarnings([]);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Food Ingredient Scanner</h1>
      <input type="file" onChange={handleImageUpload} />
      <br /><br />
      <label>
        Preferred language:{' '}
        <select value={lang} onChange={e => setLang(e.target.value)}>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </label>
      {' '}
      <label>
        Preferred country (optional):{' '}
        <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Poland or PL" />
      </label>
      <br /><br />
      <input type="text" placeholder="Enter barcode or product name" onKeyDown={(e) => {
        if (e.key === 'Enter') handleSearch(e.target.value);
      }} />
      {loading && <p>Loading…</p>}

      {searchResults.length > 0 && (
        <div>
          <h4>Pick the right product variant:</h4>
          <ul>
            {searchResults.map(r => (
              <li key={r.code}>
                <strong>{r.name || '(no name)'}</strong> — {r.countries || r.countries_tags.join(', ')}{' '}
                <button onClick={() => fetchProductByCode(r.code)}>Select</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <br /><br />
      <h3>Ingredients:</h3>
      <p>{ingredients}</p>
      <h3>Warnings:</h3>
      <ul>
        {warnings.map((item, i) => <li key={i}>⚠️ {item}</li>)}
      </ul>
    </div>
  );
}

export default App;