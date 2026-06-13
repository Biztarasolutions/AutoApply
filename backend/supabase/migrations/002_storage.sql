-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('cover-letters', 'cover-letters', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- RLS policies for resumes bucket
CREATE POLICY "Users can upload their own resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can update their own resumes" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can read their own resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own resumes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resumes' AND auth.uid() = owner);

-- RLS policies for cover-letters bucket
CREATE POLICY "Users can upload their own cover letters" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cover-letters' AND auth.uid() = owner);
CREATE POLICY "Users can update their own cover letters" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cover-letters' AND auth.uid() = owner);
CREATE POLICY "Users can read their own cover letters" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cover-letters' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own cover letters" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cover-letters' AND auth.uid() = owner);

-- RLS policies for avatars bucket
CREATE POLICY "Users can upload their own avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can read their own avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid() = owner);
