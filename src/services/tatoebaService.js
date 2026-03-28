import { supabase } from './supabaseClient';

/**
 * Searches Tatoeba using the Supabase Edge Function proxy.
 * Returning max 8 results: [{ id, italiano, español }]
 * @param {string} query The search query (Italian word/phrase)
 */
export const searchTatoeba = async (query) => {
    try {
        const { data, error } = await supabase.functions.invoke('tatoeba-search', {
            body: { query }
        });

        if (error) {
            console.error("Tatoeba Proxy Error:", error);
            throw new Error("Tatoeba non risponde. Riprova più tardi.");
        }

        if (!data || data.error) {
            throw new Error((data && data.error) || "Tatoeba non risponde. Riprova più tardi.");
        }

        return data; // Array of results
    } catch (err) {
        console.error("searchTatoeba Error:", err);
        throw err;
    }
};
