import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Competitor } from '../types/database';

export const useCompetitors = () => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('competitors')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setCompetitors(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch competitors');
        setCompetitors([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitors();
  }, []);

  const addCompetitor = async (competitor: Omit<Competitor, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('competitors')
        .insert([competitor])
        .select()
        .single();

      if (insertError) throw insertError;
      setCompetitors([data, ...competitors]);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add competitor';
      setError(errorMessage);
      throw err;
    }
  };

  const updateCompetitor = async (id: string, updates: Partial<Competitor>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('competitors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      setCompetitors(competitors.map(c => c.id === id ? data : c));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update competitor';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteCompetitor = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('competitors')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setCompetitors(competitors.filter(c => c.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete competitor';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    competitors,
    loading,
    error,
    addCompetitor,
    updateCompetitor,
    deleteCompetitor,
  };
};
