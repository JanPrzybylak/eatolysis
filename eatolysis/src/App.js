import React, { useState } from 'react';
import axios from 'axios';
import Tesseract from 'tesseract.js';

function App() {
  const [image, setImage] = useState(null);
  const [ingredients, setIngredients] = useState('');
  const [warnings, setWarnings] = useState([]);

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

const handleSearch = async (query) => {
  if (!query) return;
  const q = query.trim();

  try {
    let product = null;

    // barcode
    if (/^\d+$/.test(q)) {
      const res = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(q)}.json`);
      product = res.data.product;
    } else {
      // by name
      const searchRes = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
        params: {
          search_terms: q,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: 1
        }
      });

      const first = (searchRes.data && searchRes.data.products && searchRes.data.products[0]) || null;
      if (first && first.code) {
        const res = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(first.code)}.json`);
        product = res.data.product;
      }
    }

    if (!product || !product.ingredients_text) {
      setIngredients('No ingredient info found for this product.');
      setWarnings([]);
      return;
    }

    const text = product.ingredients_text;
    setIngredients(text);

    const found = badList.filter(item => text.toLowerCase().includes(item));
    setWarnings(found);
  } catch (error) {
    console.error('Error fetching product:', error);
    setIngredients('Product not found or API error.');
    setWarnings([]);
  }
};

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Food Ingredient Scanner</h1>
      <input type="file" onChange={handleImageUpload} />
      <br /><br />
      <input type="text" placeholder="Enter barcode or product name" onKeyDown={(e) => {
        if (e.key === 'Enter') handleSearch(e.target.value);
      }} />
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