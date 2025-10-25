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
  try {
    const res = await axios.get(`https://world.openfoodfacts.net/api/v2/product/${query}.json`);  //STAGING, CHANGE LATER TO PROD!!!!
    const data = res.data.product;

    if (!data || !data.ingredients_text) {
      setIngredients('No ingredient info found for this product.');
      setWarnings([]);
      return;
    }

    const text = data.ingredients_text;
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