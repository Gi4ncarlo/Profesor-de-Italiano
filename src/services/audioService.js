import { supabase } from './supabase';

export const uploadAudio = async (blob, folder) => {
    try {
        // Use actual blob type or default to webm
        const actualType = blob.type || 'audio/webm';
        const fileExt = actualType.split('/')[1]?.split(';')[0] || 'webm';
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('audio-tasks')
            .upload(filePath, blob, {
                contentType: actualType,
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('audio-tasks')
            .getPublicUrl(filePath);

        return { url: publicUrl, error: null };
    } catch (error) {
        console.error('Error uploading audio:', error);
        return { url: null, error };
    }
};

export const getAudioUrl = (filePath) => {
    const { data: { publicUrl } } = supabase.storage
        .from('audio-tasks')
        .getPublicUrl(filePath);
    return publicUrl;
};
