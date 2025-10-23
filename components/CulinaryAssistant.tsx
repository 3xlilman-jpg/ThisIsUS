import React, { useState, useRef } from 'react';
import { generateCookingSuggestions } from '../services/geminiService';
import type { Recipe, GroundingSource } from '../types';
import { Loader } from './Loader';
import { LinkIcon, ClockIcon, ChevronDownIcon } from './icons';

const SUGGESTIONS = [
    'Comida Boricua',
    'Cubano',
    'Italian Eats',
    'Chinese',
    'Japanese cuisine',
    'Comfort Food'
];

export const CulinaryAssistant: React.FC = () => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Recipe[]>([]);
    const [sources, setSources] = useState<GroundingSource[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openRecipeIndex, setOpenRecipeIndex] = useState<number | null>(null);
    const [lastQuery, setLastQuery] = useState('');
    const seenRecipesRef = useRef<string[]>([]);


    const handleGenerate = async (queryOverride?: string) => {
        const currentQuery = queryOverride || query;
        if (!currentQuery.trim()) return;

        if (currentQuery.toLowerCase() !== lastQuery.toLowerCase()) {
            seenRecipesRef.current = [];
        }
        setLastQuery(currentQuery);

        setIsGenerating(true);
        setError(null);
        setSuggestions([]);
        setSources([]);
        setOpenRecipeIndex(null);
        try {
            const result = await generateCookingSuggestions(currentQuery, seenRecipesRef.current);
            const newTitles = result.suggestions.map(s => s.title);
            seenRecipesRef.current.push(...newTitles);

            setSuggestions(result.suggestions);
            setSources(result.sources);
        } catch (err) {
            console.error("Recipe generation failed:", err);
            setError("Sorry, I couldn't generate suggestions. The format from the AI was unexpected. Please try a different query.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        handleGenerate(suggestion);
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
            <h2 className="text-4xl font-extrabold text-amber-400 sm:text-5xl text-center">Culinary Corner</h2>
            <p className="mt-4 text-lg text-gray-400 text-center">Feeling hungry? Tell Rose what you're craving, or pick a suggestion below.</p>
            
            <div className="mt-8 space-y-6">
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., 'Something light and healthy for a weeknight dinner, using chicken...'"
                    className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 transition-colors text-gray-300 placeholder-gray-500"
                    rows={3}
                />
                
                <div className="flex flex-wrap justify-center gap-3">
                    {SUGGESTIONS.map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-4 py-2 bg-gray-700/50 text-amber-300 text-sm rounded-full border border-gray-600 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
                
                <button onClick={() => handleGenerate()} disabled={isGenerating || !query} className="w-full bg-amber-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-amber-500 transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isGenerating ? <Loader /> : 'Get Suggestions'}
                </button>
            </div>
            
            <div className="mt-12">
                {isGenerating && (
                    <div className="flex flex-col items-center justify-center h-64 bg-black/30 rounded-2xl">
                        <Loader />
                        <p className="mt-4 text-amber-400 font-semibold">Cooking up some ideas...</p>
                        <p className="mt-1 text-sm text-gray-400">This can take a moment.</p>
                    </div>
                )}
                
                {error && <p className="text-center text-red-400">{error}</p>}

                {suggestions.length > 0 && (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-3xl font-bold text-amber-300 text-center">Here are some ideas from Rose!</h3>
                        {suggestions.map((recipe, index) => (
                            <div key={index} className="bg-black/50 rounded-2xl border border-gray-700 shadow-2xl shadow-black/30 overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => setOpenRecipeIndex(openRecipeIndex === index ? null : index)}
                                    className="w-full text-left p-6 flex justify-between items-center hover:bg-gray-800/50"
                                >
                                    <h4 className="text-2xl font-bold text-amber-400">{recipe.title}</h4>
                                    <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${openRecipeIndex === index ? 'rotate-180' : ''}`} />
                                </button>
                                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openRecipeIndex === index ? 'max-h-[2000px]' : 'max-h-0'}`}>
                                    <div className="px-6 pb-6 pt-2">
                                        {recipe.imageUrl && (
                                            <img 
                                                src={recipe.imageUrl} 
                                                alt={`A delicious photo of ${recipe.title}`}
                                                className="w-full h-64 object-cover rounded-lg mb-6 shadow-lg shadow-black/40"
                                            />
                                        )}
                                        <div className="flex items-center gap-4 text-gray-400 mb-4 border-t border-gray-700 pt-4">
                                            <ClockIcon className="w-5 h-5" />
                                            <span className="text-sm font-medium">{recipe.cookTime}</span>
                                        </div>
                                        <p className="text-gray-400 mt-2 mb-4 italic">"{recipe.description}"</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="md:col-span-1">
                                                <h5 className="font-semibold text-lg text-amber-300 mb-2">Ingredients</h5>
                                                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                                                    {recipe.ingredients.map((item, i) => <li key={i}>{item}</li>)}
                                                </ul>
                                            </div>
                                            <div className="md:col-span-2">
                                                <h5 className="font-semibold text-lg text-amber-300 mb-2">Instructions</h5>
                                                <ol className="list-decimal list-inside space-y-3 text-gray-300 text-sm">
                                                    {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                         {!isGenerating && (
                            <div className="flex justify-center pt-4">
                                <button onClick={() => handleGenerate()} className="w-full sm:w-auto bg-gray-700 text-amber-300 font-bold py-3 px-6 rounded-lg hover:bg-gray-600 transition-all duration-300 ease-in-out">
                                    Refresh or Refine Suggestions
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                {sources.length > 0 && (
                    <div className="bg-black/50 p-6 rounded-2xl border border-gray-700 shadow-2xl shadow-black/30 mt-8">
                        <div className="flex items-center mb-4 border-b-2 border-amber-500/20 pb-3">
                            <LinkIcon className="w-6 h-6 text-amber-400 mr-3" />
                            <h3 className="text-xl font-semibold text-amber-300">Web Sources</h3>
                        </div>
                        <ul className="space-y-2">
                            {sources.map((source, index) => (
                                <li key={index}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 hover:underline transition-colors text-sm">
                                        {source.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};