import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Users, Plus, Trash2, Pencil, KeyRound, Eye, EyeOff, Copy, Check, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import AdminDeleteConfirm from './AdminDeleteConfirm';
import { sortByRoll } from '@/lib/sortMembers';

export default function MemberManagement() {
  const { user, isAdmin, isManager } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Add member form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newYear, setNewYear] = useState('1st');
  const [newGender, setNewGender] = useState('male');
  const [newRoll, setNewRoll] = useState('');

  // Edit member
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editYear, setEditYear] = useState('1st');
  const [editGender, setEditGender] = useState('male');
  const [editRoll, setEditRoll] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMember, setResetMember] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetSuccessData, setResetSuccessData] = useState<{ memberName: string; password: string } | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    if (!profiles || profiles.length === 0) { setMembers([]); return; }
    
    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', userIds);
    
    const roleMap: Record<string, { role: string }[]> = {};
    (roles || []).forEach(r => {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push({ role: r.role });
    });
    
    setMembers(sortByRoll(profiles.map(p => ({ ...p, user_roles: roleMap[p.user_id] || [] }))));
  };

  const handleAddMember = async () => {
    if (!newName || !newEmail || !newPassword) {
      toast.error('নাম, ইমেইল ও পাসওয়ার্ড দিন');
      return;
    }
    setAddLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            full_name: newName,
            year: newYear,
            gender: newGender,
            roll_number: newRoll || null,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;

      toast.success(`${newName} যোগ হয়েছে!`);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRoll('');
      setNewYear('1st'); setNewGender('male');
      setAddOpen(false);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'সদস্য যোগ করতে সমস্যা হয়েছে');
    }
    setAddLoading(false);
  };

  const openEditDialog = (member: any) => {
    setEditMember(member);
    setEditName(member.full_name);
    setEditYear(member.year);
    setEditGender(member.gender);
    setEditRoll(member.roll_number || '');
    setEditPassword('');
    setShowEditPassword(false);
    setEditOpen(true);
  };

  const handleEditMember = async () => {
    if (!editMember || !editName.trim()) {
      toast.error('নাম দিন');
      return;
    }
    setEditLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editName.trim(),
        year: editYear as any,
        gender: editGender as any,
        roll_number: editRoll.trim() || null,
      }).eq('id', editMember.id);

      if (error) throw error;

      if (editPassword.trim()) {
        if (editPassword.trim().length < 6) {
          throw new Error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
        }
        await callAdminResetPassword(editMember.user_id, editMember.id, editPassword.trim());
        toast.success(`${editName}-এর তথ্য ও নতুন পাসওয়ার্ড আপডেট হয়েছে!`);
      } else {
        toast.success(`${editName} আপডেট হয়েছে`);
      }

      setEditOpen(false);
      setEditPassword('');
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'আপডেট করতে সমস্যা হয়েছে');
    }
    setEditLoading(false);
  };

  const handleDeleteMember = async (member: any) => {
    const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', member.id);
    if (error) {
      toast.error('মুছতে সমস্যা হয়েছে');
    } else {
      toast.success(`${member.full_name} সরানো হয়েছে`);
      fetchMembers();
    }
  };

  const openResetDialog = (member: any) => {
    setResetMember(member);
    setResetPassword('');
    setResetConfirmPassword('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setResetSuccessData(null);
    setResetOpen(true);
  };

  const handleQuickPassword = (preset: string) => {
    let pass = preset;
    if (preset === 'random') {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      pass = `smc${randomNum}`;
    }
    setResetPassword(pass);
    setResetConfirmPassword(pass);
    toast.info(`পাসওয়ার্ড বসানো হয়েছে: ${pass}`);
  };

  const callAdminResetPassword = async (targetUserId: string, profileId: string, newPasswordStr: string) => {
    // 1. Try admin-reset-password first
    let res = await supabase.functions.invoke('admin-reset-password', {
      body: {
        target_user_id: targetUserId,
        profile_id: profileId,
        new_password: newPasswordStr,
      },
    });

    // 2. If it fails, fallback to password-reset-otp with action: admin_reset
    if (res.error || res.data?.error) {
      const fallbackRes = await supabase.functions.invoke('password-reset-otp', {
        body: {
          action: 'admin_reset',
          target_user_id: targetUserId,
          profile_id: profileId,
          caller_user_id: user?.id,
          new_password: newPasswordStr,
        },
      });
      if (!fallbackRes.error && !fallbackRes.data?.error) {
        res = fallbackRes;
      }
    }

    if (res.error) {
      let errMsg = res.error.message;
      if (res.error.context && typeof res.error.context.json === 'function') {
        try {
          const errBody = await res.error.context.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch {}
      }
      throw new Error(errMsg || 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে');
    }

    if (res.data?.error) {
      throw new Error(res.data.error);
    }

    return res.data;
  };

  const handleResetPassword = async () => {
    if (!resetMember) return;
    if (resetPassword.length < 6) { toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে'); return; }
    if (resetPassword !== resetConfirmPassword) { toast.error('পাসওয়ার্ড মিলছে না!'); return; }
    setResetLoading(true);
    try {
      await callAdminResetPassword(resetMember.user_id, resetMember.id, resetPassword);
      
      setResetSuccessData({
        memberName: resetMember.full_name,
        password: resetPassword,
      });
      toast.success(`${resetMember.full_name}-এর পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!`);
    } catch (err: any) {
      toast.error(err.message || 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে');
    }
    setResetLoading(false);
  };

  const filtered = members.filter(m => {
    if (search && !m.full_name.toLowerCase().includes(search.toLowerCase()) && !(m.roll_number || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterYear !== 'all' && m.year !== filterYear) return false;
    if (filterGender !== 'all' && m.gender !== filterGender) return false;
    return true;
  });

  return (
    <Card className="holo-card animate-fade-in-up overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
            <Users className="h-5 w-5 text-primary animate-float" /> সদস্য তালিকা ({filtered.length})
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="font-bengali gap-1">
                  <Plus className="h-4 w-4" /> সদস্য যোগ করুন
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bengali">নতুন সদস্য যোগ করুন</DialogTitle>
                  <DialogDescription className="font-bengali">সদস্যের তথ্য দিন</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="font-bengali">পুরো নাম *</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="নাম লিখুন" />
                  </div>
                  <div>
                    <Label className="font-bengali">ইমেইল *</Label>
                    <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div>
                    <Label className="font-bengali">পাসওয়ার্ড *</Label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="ন্যূনতম ৬ অক্ষর" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-bengali">Year</Label>
                      <Select value={newYear} onValueChange={setNewYear}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1st">1st Year</SelectItem>
                          <SelectItem value="2nd">2nd Year</SelectItem>
                          <SelectItem value="3rd">3rd Year</SelectItem>
                          <SelectItem value="4th">4th Year</SelectItem>
                          <SelectItem value="5th">5th Year</SelectItem>
                          <SelectItem value="extra">Extra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="font-bengali">লিঙ্গ</Label>
                      <Select value={newGender} onValueChange={setNewGender}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">ছেলে</SelectItem>
                          <SelectItem value="female">মেয়ে</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="font-bengali">রোল নম্বর</Label>
                    <Input value={newRoll} onChange={e => setNewRoll(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddMember} disabled={addLoading} className="font-bengali">
                    {addLoading ? 'যোগ হচ্ছে...' : 'যোগ করুন'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="নাম খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব Year</SelectItem>
              <SelectItem value="1st">1st</SelectItem>
              <SelectItem value="2nd">2nd</SelectItem>
              <SelectItem value="3rd">3rd</SelectItem>
              <SelectItem value="4th">4th</SelectItem>
              <SelectItem value="5th">5th</SelectItem>
              <SelectItem value="extra">Extra</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterGender} onValueChange={setFilterGender}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Gender" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব</SelectItem>
              <SelectItem value="male">ছেলে</SelectItem>
              <SelectItem value="female">মেয়ে</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-auto card-shine">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bengali">নাম</TableHead>
                <TableHead className="font-bengali">Year</TableHead>
                <TableHead className="font-bengali">লিঙ্গ</TableHead>
                <TableHead className="font-bengali">রোল</TableHead>
                <TableHead className="font-bengali">ভূমিকা</TableHead>
                <TableHead className="font-bengali w-24">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m, i) => (
                <TableRow key={m.id} className="animate-fade-in transition-all duration-300 hover:bg-primary/5" style={{ animationDelay: `${i * 0.03}s` }}>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell><Badge variant="outline">{m.year}</Badge></TableCell>
                  <TableCell className="font-bengali">{m.gender === 'male' ? 'ছেলে' : 'মেয়ে'}</TableCell>
                  <TableCell>{m.roll_number || '—'}</TableCell>
                  <TableCell>
                    {(m.user_roles || []).map((r: any) => (
                      <Badge key={r.role} variant={r.role === 'meal_manager' ? 'default' : 'secondary'} className="mr-1">
                        {r.role === 'meal_manager' ? 'ম্যানেজার' : r.role === 'super_admin' ? 'অ্যাডমিন' : 'ছাত্র'}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(m)} title="সম্পাদনা">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => openResetDialog(m)} title="পাসওয়ার্ড রিসেট">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <AdminDeleteConfirm
                        title={`${m.full_name}-কে সরাবেন?`}
                        description={`${m.full_name}-কে সদস্য তালিকা থেকে সরাতে অ্যাডমিন পাসওয়ার্ড দিন।`}
                        onConfirm={() => handleDeleteMember(m)}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="সরান">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit Member Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bengali flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> সদস্য তথ্য সম্পাদনা
            </DialogTitle>
            <DialogDescription className="font-bengali">সদস্যের তথ্য ও ঐচ্ছিক পাসওয়ার্ড পরিবর্তন করুন</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-bengali">পুরো নাম *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bengali">Year</Label>
                <Select value={editYear} onValueChange={setEditYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st">1st Year</SelectItem>
                    <SelectItem value="2nd">2nd Year</SelectItem>
                    <SelectItem value="3rd">3rd Year</SelectItem>
                    <SelectItem value="4th">4th Year</SelectItem>
                    <SelectItem value="5th">5th Year</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-bengali">লিঙ্গ</Label>
                <Select value={editGender} onValueChange={setEditGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ছেলে</SelectItem>
                    <SelectItem value="female">মেয়ে</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="font-bengali">রোল নম্বর</Label>
              <Input value={editRoll} onChange={e => setEditRoll(e.target.value)} placeholder="ঐচ্ছিক" />
            </div>
            <div className="pt-2 border-t border-border/40">
              <Label className="font-bengali flex items-center justify-between text-xs text-muted-foreground">
                <span>নতুন পাসওয়ার্ড দিন (ঐচ্ছিক)</span>
                <span className="text-[10px]">অপরিবর্তিত রাখতে খালি রাখুন</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showEditPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="পরিবর্তন করতে চাইলে নতুন পাসওয়ার্ড লিখুন"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={showEditPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                >
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="font-bengali">বাতিল</Button>
            <Button onClick={handleEditMember} disabled={editLoading} className="font-bengali">
              {editLoading ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bengali flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> পাসওয়ার্ড রিসেট ও পরিবর্তন
            </DialogTitle>
            <DialogDescription className="font-bengali">
              {resetMember?.full_name}-এর অ্যাকাউন্টের জন্য পাসওয়ার্ড সেট করুন
            </DialogDescription>
          </DialogHeader>

          {resetSuccessData ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-fade-in text-center my-2">
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold font-bengali">
                <Check className="h-5 w-5" /> পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!
              </div>
              <p className="text-xs text-muted-foreground font-bengali">
                <strong>{resetSuccessData.memberName}</strong>-এর জন্য নতুন পাসওয়ার্ড:
              </p>
              <div className="font-mono text-xl font-bold bg-background/90 text-primary border border-primary/30 py-1.5 px-4 rounded-lg inline-block tracking-wider shadow-inner">
                {resetSuccessData.password}
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full font-bengali gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
                  onClick={() => {
                    const msg = `প্রিয় ${resetSuccessData.memberName},\nআপনার SMC Meal Mate অ্যাকাউন্টের পাসওয়ার্ড রিসেট করা হয়েছে।\n🔑 নতুন পাসওয়ার্ড: ${resetSuccessData.password}\n🌐 লগইন লিঙ্ক: ${window.location.origin}/auth`;
                    navigator.clipboard.writeText(msg);
                    toast.success('হোয়াটসঅ্যাপ / মেসেজ টেক্সট কপি করা হয়েছে!');
                  }}
                >
                  <Copy className="h-4 w-4" /> হোয়াটসঅ্যাপ / মেসেজ কপি করুন
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 my-1">
              {/* Member Quick Info */}
              <div className="bg-muted/40 p-3 rounded-xl border border-border/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{resetMember?.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{resetMember?.year} Year</Badge>
                  <span>রোল: {resetMember?.roll_number || '—'}</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <Label className="font-bengali text-xs text-muted-foreground">⚡ দ্রুত পাসওয়ার্ড বসান:</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs flex-1 h-8 bg-background/60"
                    onClick={() => handleQuickPassword('123456')}
                  >
                    123456
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-bengali text-xs flex-1 h-8 gap-1 bg-background/60"
                    onClick={() => handleQuickPassword('random')}
                  >
                    <Sparkles className="h-3 w-3 text-amber-500" /> র্যান্ডম পিন
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="font-bengali text-sm">নতুন পাসওয়ার্ড *</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showResetPassword ? 'text' : 'password'}
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      placeholder="ন্যূনতম ৬ অক্ষর"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showResetPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="font-bengali text-sm">পাসওয়ার্ড নিশ্চিত করুন *</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      value={resetConfirmPassword}
                      onChange={e => setResetConfirmPassword(e.target.value)}
                      placeholder="আবার লিখুন"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showResetConfirmPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                    >
                      {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetOpen(false)} className="font-bengali">
              {resetSuccessData ? 'বন্ধ করুন' : 'বাতিল'}
            </Button>
            {!resetSuccessData && (
              <Button
                onClick={handleResetPassword}
                disabled={resetLoading || resetPassword.length < 6}
                className="font-bengali gap-1.5 bg-gradient-to-r from-primary to-info"
              >
                <KeyRound className="h-4 w-4" />
                {resetLoading ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড সেট করুন'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
