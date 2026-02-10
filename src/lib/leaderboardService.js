import { supabase } from './supabase';

// Fetch all schools for the dropdown picker (with town)
export const getAllSchools = async () => {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, town')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching schools:', error);
    return [];
  }

  return data || [];
};

// Search for schools by name or town (for the school picker)
export const searchSchools = async (query) => {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim();
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, town')
    .or(`name.ilike.%${trimmed}%,town.ilike.%${trimmed}%`)
    .order('name', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Error searching schools:', error);
    return [];
  }

  return data || [];
};

// Create a new school (with town)
export const createSchool = async (schoolName, town, userId) => {
  if (!schoolName?.trim()) throw new Error('School name is required');
  if (!town?.trim()) throw new Error('Town/region is required');

  const trimmedName = schoolName.trim();
  const trimmedTown = town.trim();

  // Check if it already exists (case-insensitive name + town)
  const { data: existing } = await supabase
    .from('schools')
    .select('id, name, town')
    .ilike('name', trimmedName)
    .ilike('town', trimmedTown)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('schools')
    .insert({ name: trimmedName, town: trimmedTown, created_by: userId })
    .select()
    .single();

  if (error) {
    console.error('Error creating school:', error);
    throw new Error(error.message || 'Failed to create school');
  }

  return data;
};

// Join a school (leaves current school first)
export const joinSchool = async (userId, schoolId) => {
  if (!userId || !schoolId) throw new Error('User ID and School ID are required');

  // Leave any existing school first
  await leaveSchool(userId);

  const { data, error } = await supabase
    .from('school_members')
    .insert({ user_id: userId, school_id: schoolId })
    .select()
    .single();

  if (error) {
    console.error('Error joining school:', error);
    throw new Error(error.message || 'Failed to join school');
  }

  return data;
};

// Leave current school
export const leaveSchool = async (userId) => {
  if (!userId) throw new Error('User ID is required');

  const { error } = await supabase
    .from('school_members')
    .delete()
    .eq('user_id', userId);

  // PGRST116 = no rows found, which is fine
  if (error && error.code !== 'PGRST116') {
    console.error('Error leaving school:', error);
    throw new Error(error.message || 'Failed to leave school');
  }
};

// Get user's current school (returns { id, name, town } or null)
export const getUserSchool = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('school_members')
    .select('school_id, schools(id, name, town)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user school:', error);
    return null;
  }

  return data?.schools || null;
};

// Get leaderboard for a school via RPC function
export const getSchoolLeaderboard = async (schoolId) => {
  if (!schoolId) throw new Error('School ID is required');

  const { data, error } = await supabase
    .rpc('get_school_leaderboard', { p_school_id: schoolId });

  if (error) {
    console.error('Error fetching leaderboard:', error);
    throw new Error(error.message || 'Failed to fetch leaderboard');
  }

  // Add rank numbers
  return (data || []).map((entry, index) => ({
    rank: index + 1,
    userId: entry.user_id,
    displayName: entry.display_name,
    totalCorrect: entry.total_correct
  }));
};
