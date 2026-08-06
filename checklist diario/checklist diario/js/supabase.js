// supabase.js - Integração com o banco de dados Supabase

// ATENÇÃO: Substitua os valores abaixo pelas credenciais do seu projeto Supabase!
const SUPABASE_URL = 'SUA_SUPABASE_URL_AQUI';
const SUPABASE_KEY = 'SUA_SUPABASE_ANON_KEY_AQUI';

let supabaseClient = null;

if (window.supabase && SUPABASE_URL !== 'SUA_SUPABASE_URL_AQUI') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

export function isSupabaseConfigured() {
  return supabaseClient !== null;
}

export async function syncTasksToSupabase(tasks) {
  if (!isSupabaseConfigured()) return;

  try {
    // Para simplificar, fazemos um upsert de todas as tarefas.
    // Em um app grande, o ideal seria atualizar só as modificadas, 
    // mas como a lista do dia é pequena, isso resolve bem sem complicar.
    const { error } = await supabaseClient
      .from('tasks')
      .upsert(
        tasks.map(t => ({
          id: t.id,
          text: t.text,
          time: t.time || null,
          period: t.period || null,
          category: t.category || null,
          date: t.date,
          status: t.status || (t.done ? 'done' : 'pending'),
          created_at: t.createdAt
        })),
        { onConflict: 'id' }
      );
    
    if (error) {
      console.error('Erro ao sincronizar com Supabase:', error);
    }
  } catch (err) {
    console.error('Erro inesperado na sincronização:', err);
  }
}

export async function deleteTasksFromSupabase(taskIds) {
  if (!isSupabaseConfigured() || taskIds.length === 0) return;

  try {
    const { error } = await supabaseClient
      .from('tasks')
      .delete()
      .in('id', taskIds);
    
    if (error) {
      console.error('Erro ao excluir do Supabase:', error);
    }
  } catch (err) {
    console.error('Erro inesperado na exclusão:', err);
  }
}

export async function fetchTasksFromSupabase() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*');
      
    if (error) {
      console.error('Erro ao buscar do Supabase:', error);
      return null;
    }
    
    return data.map(row => ({
      id: row.id,
      text: row.text,
      time: row.time,
      period: row.period,
      category: row.category,
      date: row.date,
      status: row.status,
      done: row.status === 'done', // manter compatibilidade inicial
      createdAt: row.created_at
    }));
  } catch (err) {
    console.error('Erro inesperado na busca:', err);
    return null;
  }
}
