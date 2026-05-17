import React, { useState, useEffect } from 'react';
import { PlusCircle, Utensils, Activity, Settings, PieChart, Trash2, Calendar, Target, Flame, Sparkles, Loader2, Bot, Lightbulb, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STORAGE_KEY = 'calorie_tracker_data';

export default function App() {
  // --- State ---
  // Goals
  const [goals, setGoals] = useState({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65,
  });

  // Today's Entries
  const [entries, setEntries] = useState([]);
  
  // Form State
  const [newEntry, setNewEntry] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    type: 'meal', // 'meal' or 'exercise'
  });

  const [isSearching, setIsSearching] = useState(false);

  // Current Date (for display purposes)
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));

  // AI Coach State
  const [aiInsights, setAiInsights] = useState("");
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);
  const [aiMealSuggestion, setAiMealSuggestion] = useState(null);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);

  // --- Effects ---
  // Load data from local storage on mount (simulated for now, keeping it single-session robust as per rules, but showing the structure)
  useEffect(() => {
    // In a real app with persistence, we'd load here.
    // For this environment, we'll start fresh each time unless hooked up to Firebase later.
    // const savedData = localStorage.getItem(STORAGE_KEY);
    // if (savedData) { ... }
  }, []);

  // --- Calculations ---
  const calculateTotals = () => {
    return entries.reduce((acc, entry) => {
      if (entry.type === 'meal') {
        acc.caloriesIn += entry.calories || 0;
        acc.protein += entry.protein || 0;
        acc.carbs += entry.carbs || 0;
        acc.fat += entry.fat || 0;
      } else if (entry.type === 'exercise') {
        acc.caloriesOut += entry.calories || 0;
      }
      return acc;
    }, { caloriesIn: 0, caloriesOut: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const totals = calculateTotals();
  const netCalories = totals.caloriesIn - totals.caloriesOut;
  const remainingCalories = goals.calories - netCalories;

  // --- Handlers ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEntry(prev => ({
      ...prev,
      [name]: name === 'name' || name === 'type' ? value : (value === '' ? '' : Number(value))
    }));
  };

  const handleGoalChange = (e) => {
     const { name, value } = e.target;
     setGoals(prev => ({
       ...prev,
       [name]: value === '' ? '' : Number(value)
     }));
  }

  const handleAddEntry = (e) => {
    e.preventDefault();
    if (!newEntry.name || !newEntry.calories) return; // Basic validation

    const entryToAdd = {
      ...newEntry,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      // Ensure numeric fields are 0 if empty
      protein: newEntry.protein || 0,
      carbs: newEntry.carbs || 0,
      fat: newEntry.fat || 0,
    };

    setEntries(prev => [entryToAdd, ...prev]);
    
    // Reset form
    setNewEntry({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      type: newEntry.type, // Keep the same type selected
    });
  };

  const handleDeleteEntry = (id) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const handleAIFetch = async () => {
    if (!newEntry.name) return; // Works for both meal and exercise now
    setIsSearching(true);
    
    try {
     const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      let payload;
      if (newEntry.type === 'meal') {
        payload = {
          contents: [{ parts: [{ text: `Provide estimated nutritional values for a standard serving of: ${newEntry.name}. Return typical values.` }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                calories: { type: "INTEGER" },
                protein: { type: "INTEGER" },
                carbs: { type: "INTEGER" },
                fat: { type: "INTEGER" }
              },
              required: ["calories", "protein", "carbs", "fat"]
            }
          }
        };
      } else {
        // Exercise prompt
        payload = {
          contents: [{ parts: [{ text: `Estimate the calories burned doing the following exercise: "${newEntry.name}". Assume an average adult (70kg/154lbs) doing it for 30 minutes if duration and weight are not specified in the input. Return a typical integer value.` }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                calories: { type: "INTEGER", description: "Estimated calories burned" }
              },
              required: ["calories"]
            }
          }
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts?.length > 0) {
        const data = JSON.parse(result.candidates[0].content.parts[0].text);
        
        if (newEntry.type === 'meal') {
          setNewEntry(prev => ({
            ...prev,
            calories: data.calories || '',
            protein: data.protein || '',
            carbs: data.carbs || '',
            fat: data.fat || ''
          }));
        } else {
          // Only update calories for exercise
          setNewEntry(prev => ({
            ...prev,
            calories: data.calories || ''
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch from Gemini API:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGetInsights = async () => {
    setIsFetchingInsights(true);
    try {
      const apiKey = ""; // The Canvas environment automatically provides the API key here
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const prompt = `As a friendly, encouraging AI fitness and nutrition coach, provide a short 2-3 sentence analysis of my day so far.
      My daily goal is ${goals.calories} kcal.
      So far I've eaten ${totals.caloriesIn} kcal and burned ${totals.caloriesOut} kcal.
      Here are my logs: ${entries.map(e => `${e.name} (${e.type}: ${e.calories}kcal)`).join(', ')}.
      Give me a quick tip or encouragement based on what I've logged. Keep it concise.`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const result = await response.json();
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        setAiInsights(result.candidates[0].content.parts[0].text);
      }
    } catch (error) {
      console.error("Failed to fetch insights:", error);
      setAiInsights("Oops, I couldn't connect to my brain right now. Try again later!");
    } finally {
      setIsFetchingInsights(false);
    }
  };

  const handleGetMealSuggestion = async () => {
    setIsFetchingSuggestion(true);
    try {
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const remainingCal = goals.calories - (totals.caloriesIn - totals.caloriesOut);
      const remainingPro = goals.protein - totals.protein;
      const remainingCarb = goals.carbs - totals.carbs;
      const remainingFat = goals.fat - totals.fat;

      const prompt = `I need a meal or snack suggestion.
      My remaining macro targets for the day are approximately:
      Calories: ${remainingCal} kcal
      Protein: ${remainingPro}g
      Carbs: ${remainingCarb}g
      Fat: ${remainingFat}g
      Suggest exactly one specific, realistic meal or snack that closely fits these remaining targets (it doesn't have to be perfect, but should be close).
      Do not include markdown blocks.`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "Name of the meal" },
              description: { type: "STRING", description: "Short description of the meal" },
              calories: { type: "INTEGER" },
              protein: { type: "INTEGER" },
              carbs: { type: "INTEGER" },
              fat: { type: "INTEGER" }
            },
            required: ["name", "description", "calories", "protein", "carbs", "fat"]
          }
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
         setAiMealSuggestion(JSON.parse(result.candidates[0].content.parts[0].text));
      }
    } catch (error) {
      console.error("Failed to fetch meal suggestion:", error);
    } finally {
      setIsFetchingSuggestion(false);
    }
  };

  const handleAddSuggestedMeal = () => {
    if (!aiMealSuggestion) return;
    const entryToAdd = {
      name: aiMealSuggestion.name,
      calories: aiMealSuggestion.calories,
      protein: aiMealSuggestion.protein,
      carbs: aiMealSuggestion.carbs,
      fat: aiMealSuggestion.fat,
      type: 'meal',
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    setEntries(prev => [entryToAdd, ...prev]);
    setAiMealSuggestion(null); // Clear after adding
  };

  // --- Rendering Helpers ---
  const renderProgressBar = (current, max, colorClass) => {
    const percentage = Math.min(100, Math.max(0, (current / max) * 100)) || 0;
    return (
      <div className="w-full bg-zinc-800 rounded-full h-2.5 mt-2 border border-zinc-700/50">
        <div className={`h-2.5 rounded-full ${colorClass} shadow-[0_0_8px_rgba(220,38,38,0.6)]`} style={{ width: `${percentage}%` }}></div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-fixed bg-cover bg-center font-sans text-zinc-100" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')" }}>
      {/* Dark Overlay for readability */}
      <div className="fixed inset-0 bg-black/85 z-0" />
      
      <div className="relative z-10 pb-20 md:pb-0 sm:px-6 lg:px-8 max-w-md mx-auto md:max-w-4xl pt-4">
        {/* Header */}
        <header className="mb-6 px-4 md:px-0">
          <h1 className="text-3xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Activity className="text-red-600" size={32} />
            NutriTrack
          </h1>
          <p className="text-zinc-400 text-sm flex items-center gap-1 mt-1 font-medium">
            <Calendar className="w-4 h-4 text-red-500" /> {currentDate}
          </p>
        </header>

        <Tabs defaultValue="dashboard" className="w-full">
          {/* Navigation / Tab List (Bottom on mobile, top on desktop) */}
          <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-red-900/50 z-50 md:relative md:border-none md:bg-transparent md:mb-6 shadow-[0_-5px_20px_rgba(0,0,0,0.8)] md:shadow-none">
            <TabsList className="grid w-full grid-cols-5 h-16 md:h-12 md:max-w-xl md:mx-auto bg-transparent md:bg-zinc-900/50 md:border md:border-red-900/30 rounded-none md:rounded-xl">
              <TabsTrigger value="dashboard" className="flex flex-col md:flex-row gap-1 data-[state=active]:text-red-500 data-[state=active]:bg-red-950/30 text-zinc-500 rounded-lg mx-1 transition-all">
                <PieChart className="w-5 h-5" />
                <span className="text-xs md:text-sm font-semibold">Summary</span>
              </TabsTrigger>
              <TabsTrigger value="log" className="flex flex-col md:flex-row gap-1 data-[state=active]:text-red-500 data-[state=active]:bg-red-950/30 text-zinc-500 rounded-lg mx-1 transition-all">
                <PlusCircle className="w-5 h-5" />
                <span className="text-xs md:text-sm font-semibold">Log</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col md:flex-row gap-1 data-[state=active]:text-red-500 data-[state=active]:bg-red-950/30 text-zinc-500 rounded-lg mx-1 transition-all">
                <Utensils className="w-5 h-5" />
                <span className="text-xs md:text-sm font-semibold">Entries</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex flex-col md:flex-row gap-1 data-[state=active]:text-red-500 data-[state=active]:bg-red-950/30 text-zinc-500 rounded-lg mx-1 transition-all">
                <Settings className="w-5 h-5" />
                <span className="text-xs md:text-sm font-semibold">Goals</span>
              </TabsTrigger>
              <TabsTrigger value="coach" className="flex flex-col md:flex-row gap-1 data-[state=active]:text-red-500 data-[state=active]:bg-red-950/30 text-zinc-500 rounded-lg mx-1 transition-all">
                <Bot className="w-5 h-5" />
                <span className="text-xs md:text-sm font-semibold">Coach</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- Dashboard Tab --- */}
          <TabsContent value="dashboard" className="px-4 md:px-0 mt-0 animate-in fade-in zoom-in-95 duration-200">
            {/* Main Calorie Summary */}
            <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-2xl mb-6">
              <CardHeader className="pb-2 border-b border-red-900/20">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <Target className="w-5 h-5 text-red-500" /> Calories Remaining
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-black text-white">{goals.calories}</p>
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Goal</p>
                  </div>
                  <div className="text-red-500 font-bold">-</div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-white">{totals.caloriesIn}</p>
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Food</p>
                  </div>
                  <div className="text-red-500 font-bold">+</div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-white">{totals.caloriesOut}</p>
                    <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Burned</p>
                  </div>
                </div>
                
                <div className="relative pt-6 flex flex-col items-center justify-center border-t border-red-900/20 mt-4">
                   <div className={`text-5xl font-black drop-shadow-md ${remainingCalories < 0 ? 'text-red-600' : 'text-red-500'}`}>
                      {Math.abs(remainingCalories)}
                   </div>
                   <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">
                     {remainingCalories >= 0 ? 'Remaining' : 'Over Goal'}
                   </p>
                   {renderProgressBar(netCalories, goals.calories, netCalories > goals.calories ? 'bg-red-800' : 'bg-red-600')}
                </div>
              </CardContent>
            </Card>

            {/* Macros Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
               {/* Protein */}
               <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-xl">
                 <CardContent className="p-4 flex flex-col items-center">
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Protein</p>
                   <p className="text-xl font-black text-white">{totals.protein}g</p>
                   <p className="text-xs text-red-400 font-medium">/ {goals.protein}g</p>
                   {renderProgressBar(totals.protein, goals.protein, 'bg-red-500')}
                 </CardContent>
               </Card>
               {/* Carbs */}
               <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-xl">
                 <CardContent className="p-4 flex flex-col items-center">
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Carbs</p>
                   <p className="text-xl font-black text-white">{totals.carbs}g</p>
                   <p className="text-xs text-red-400 font-medium">/ {goals.carbs}g</p>
                   {renderProgressBar(totals.carbs, goals.carbs, 'bg-red-700')}
                 </CardContent>
               </Card>
               {/* Fat */}
               <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-xl">
                 <CardContent className="p-4 flex flex-col items-center">
                   <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Fat</p>
                   <p className="text-xl font-black text-white">{totals.fat}g</p>
                   <p className="text-xs text-red-400 font-medium">/ {goals.fat}g</p>
                   {renderProgressBar(totals.fat, goals.fat, 'bg-red-900')}
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

          {/* --- Log Tab --- */}
          <TabsContent value="log" className="px-4 md:px-0 mt-0 animate-in slide-in-from-right-4 duration-200">
             <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-2xl">
              <CardHeader className="border-b border-red-900/20">
                <CardTitle className="text-white">Log Activity</CardTitle>
                <CardDescription className="text-zinc-400">Add a meal or exercise session.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleAddEntry} className="space-y-5">
                  
                  {/* Entry Type Toggle */}
                  <div className="flex bg-zinc-900/80 p-1 rounded-lg border border-red-900/30">
                    <button
                      type="button"
                      onClick={() => setNewEntry({...newEntry, type: 'meal'})}
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${newEntry.type === 'meal' ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <Utensils className="w-4 h-4 inline mr-2" /> Meal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEntry({...newEntry, type: 'exercise'})}
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${newEntry.type === 'exercise' ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <Flame className="w-4 h-4 inline mr-2" /> Exercise
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-zinc-300">Name</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="name" 
                        name="name" 
                        placeholder={newEntry.type === 'meal' ? "e.g., Chicken Salad" : "e.g., Morning Run"} 
                        value={newEntry.name}
                        onChange={handleInputChange}
                        required
                        className="flex-1 bg-zinc-900/80 border-red-900/30 text-white placeholder:text-zinc-600 focus-visible:ring-red-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAIFetch}
                        disabled={!newEntry.name || isSearching}
                        className="flex-shrink-0 bg-red-950/50 text-red-400 border-red-900/50 hover:bg-red-900 hover:text-white px-3 transition-colors"
                        title="Auto-fill with AI"
                      >
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="calories" className="text-zinc-300">Calories {newEntry.type === 'exercise' ? 'Burned' : ''}</Label>
                    <Input 
                      id="calories" 
                      name="calories" 
                      type="number" 
                      placeholder="0" 
                      value={newEntry.calories}
                      onChange={handleInputChange}
                      required
                      min="0"
                      className="bg-zinc-900/80 border-red-900/30 text-white placeholder:text-zinc-600 focus-visible:ring-red-500"
                    />
                  </div>

                  {/* Macro Inputs - Only show if type is 'meal' */}
                  {newEntry.type === 'meal' && (
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="protein" className="text-xs text-zinc-400">Protein (g)</Label>
                        <Input 
                          id="protein" name="protein" type="number" placeholder="0" 
                          value={newEntry.protein} onChange={handleInputChange} min="0"
                          className="bg-zinc-900/80 border-red-900/30 text-white placeholder:text-zinc-600 focus-visible:ring-red-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="carbs" className="text-xs text-zinc-400">Carbs (g)</Label>
                        <Input 
                          id="carbs" name="carbs" type="number" placeholder="0" 
                          value={newEntry.carbs} onChange={handleInputChange} min="0"
                          className="bg-zinc-900/80 border-red-900/30 text-white placeholder:text-zinc-600 focus-visible:ring-red-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fat" className="text-xs text-zinc-400">Fat (g)</Label>
                        <Input 
                          id="fat" name="fat" type="number" placeholder="0" 
                          value={newEntry.fat} onChange={handleInputChange} min="0"
                          className="bg-zinc-900/80 border-red-900/30 text-white placeholder:text-zinc-600 focus-visible:ring-red-500"
                        />
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white font-bold tracking-wide shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add {newEntry.type === 'meal' ? 'Meal' : 'Exercise'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Entries / History Tab --- */}
          <TabsContent value="history" className="px-4 md:px-0 mt-0 animate-in slide-in-from-right-4 duration-200">
             <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-2xl">
              <CardHeader className="border-b border-red-900/20">
                <CardTitle className="text-white">Today's Log</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Utensils className="w-12 h-12 mx-auto text-red-900/50 mb-3" />
                    <p className="font-medium">No entries yet today.</p>
                    <p className="text-sm">Go to the Log tab to add one!</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between p-4 rounded-xl border border-red-900/30 bg-zinc-900/80 shadow-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${entry.type === 'meal' ? 'bg-red-950/50 text-red-500 border border-red-900/50' : 'bg-orange-950/50 text-orange-500 border border-orange-900/50'}`}>
                            {entry.type === 'meal' ? <Utensils className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-white text-lg">{entry.name}</p>
                            <div className="flex gap-3 text-xs text-zinc-400 mt-1 font-medium">
                              {entry.type === 'meal' ? (
                                <>
                                  <span className="text-red-400">{entry.calories} kcal</span>
                                  <span>• {entry.protein}P</span>
                                  <span>• {entry.carbs}C</span>
                                  <span>• {entry.fat}F</span>
                                </>
                              ) : (
                                <span className="text-orange-400">-{entry.calories} kcal burned</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)} className="text-zinc-500 hover:text-red-500 hover:bg-red-950/50">
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Settings / Goals Tab --- */}
          <TabsContent value="settings" className="px-4 md:px-0 mt-0 animate-in slide-in-from-right-4 duration-200">
             <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-2xl">
              <CardHeader className="border-b border-red-900/20">
                <CardTitle className="text-white">Daily Goals</CardTitle>
                <CardDescription className="text-zinc-400">Set your target intake.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                 <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="goal-calories" className="font-bold text-zinc-300">Daily Calories (kcal)</Label>
                      <Input 
                        id="goal-calories" name="calories" type="number" 
                        value={goals.calories} onChange={handleGoalChange}
                        className="text-lg font-bold bg-zinc-900/80 border-red-900/30 text-white focus-visible:ring-red-500"
                      />
                    </div>
                    
                    <div className="pt-6 border-t border-red-900/20">
                      <h3 className="font-bold text-white mb-4 tracking-wide">Macronutrient Targets (g)</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="goal-protein" className="w-1/3 text-zinc-400 font-medium">Protein</Label>
                          <Input 
                            id="goal-protein" name="protein" type="number" 
                            value={goals.protein} onChange={handleGoalChange}
                            className="w-2/3 bg-zinc-900/80 border-red-900/30 text-white focus-visible:ring-red-500"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="goal-carbs" className="w-1/3 text-zinc-400 font-medium">Carbs</Label>
                          <Input 
                            id="goal-carbs" name="carbs" type="number" 
                            value={goals.carbs} onChange={handleGoalChange}
                            className="w-2/3 bg-zinc-900/80 border-red-900/30 text-white focus-visible:ring-red-500"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="goal-fat" className="w-1/3 text-zinc-400 font-medium">Fat</Label>
                          <Input 
                            id="goal-fat" name="fat" type="number" 
                            value={goals.fat} onChange={handleGoalChange}
                            className="w-2/3 bg-zinc-900/80 border-red-900/30 text-white focus-visible:ring-red-500"
                          />
                        </div>
                      </div>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- AI Coach Tab --- */}
          <TabsContent value="coach" className="px-4 md:px-0 mt-0 animate-in slide-in-from-right-4 duration-200 space-y-6">
            <Card className="border border-red-900/50 bg-black/80 backdrop-blur-md shadow-[0_0_30px_rgba(220,38,38,0.1)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-red-500 to-red-900"></div>
              <CardHeader className="border-b border-red-900/20">
                <CardTitle className="flex items-center gap-2 text-red-500 text-xl">
                  <Bot className="w-6 h-6" /> Daily Insights
                </CardTitle>
                <CardDescription className="text-zinc-400">Get personalized feedback on your day's progress.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {aiInsights ? (
                  <div className="bg-zinc-900/80 p-5 rounded-xl border border-red-900/30 text-zinc-200 text-sm leading-relaxed mb-5 shadow-inner">
                    {aiInsights}
                  </div>
                ) : null}
                <Button 
                  onClick={handleGetInsights} 
                  disabled={isFetchingInsights}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                >
                  {isFetchingInsights ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {aiInsights ? "Refresh Insights" : "Analyze My Day"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-red-900/30 bg-black/60 backdrop-blur-md shadow-2xl">
              <CardHeader className="border-b border-red-900/20">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Lightbulb className="w-5 h-5 text-red-500" /> Smart Meal Suggestion
                </CardTitle>
                <CardDescription className="text-zinc-400">Need ideas? AI can suggest a meal that perfectly fits your remaining macros.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {aiMealSuggestion && (
                  <div className="bg-zinc-900/80 p-5 rounded-xl border border-red-900/50 mb-5 animate-in fade-in shadow-lg">
                    <h4 className="font-black text-white text-xl mb-1">{aiMealSuggestion.name}</h4>
                    <p className="text-sm text-zinc-400 mb-4">{aiMealSuggestion.description}</p>
                    <div className="grid grid-cols-4 gap-3 text-center text-xs font-bold mb-5">
                      <div className="bg-black/50 p-2 rounded-lg border border-red-900/30"><span className="block text-zinc-500 mb-1">Kcal</span><span className="text-white text-sm">{aiMealSuggestion.calories}</span></div>
                      <div className="bg-black/50 p-2 rounded-lg border border-red-900/30"><span className="block text-zinc-500 mb-1">Pro</span><span className="text-red-400 text-sm">{aiMealSuggestion.protein}g</span></div>
                      <div className="bg-black/50 p-2 rounded-lg border border-red-900/30"><span className="block text-zinc-500 mb-1">Carbs</span><span className="text-red-400 text-sm">{aiMealSuggestion.carbs}g</span></div>
                      <div className="bg-black/50 p-2 rounded-lg border border-red-900/30"><span className="block text-zinc-500 mb-1">Fat</span><span className="text-red-400 text-sm">{aiMealSuggestion.fat}g</span></div>
                    </div>
                    <Button onClick={handleAddSuggestedMeal} variant="outline" className="w-full border-red-500 text-red-500 hover:bg-red-950 hover:text-white font-bold">
                      <Check className="w-4 h-4 mr-2" /> Log this Meal
                    </Button>
                  </div>
                )}
                <Button 
                  onClick={handleGetMealSuggestion} 
                  disabled={isFetchingSuggestion}
                  variant={aiMealSuggestion ? "outline" : "default"}
                  className={!aiMealSuggestion ? "w-full bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600" : "w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                >
                  {isFetchingSuggestion ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-red-500" />}
                  {aiMealSuggestion ? "Get Another Idea" : "Suggest a Meal"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}