import re
R='/root/mm-fix/admin-residente/'
tr={'es':'Publicación eliminada','en':'Deleted post','fr':'Publication supprimée','de':'Gelöschter Beitrag','it':'Post eliminato','pt':'Publicação excluída','ca':'Publicació eliminada','zh':'帖子已删除'}
for l,v in tr.items():
    p=R+'src/lib/i18n/%s.ts'%l; s=open(p,encoding='utf-8').read()
    m=re.findall(r"\n(    auditEmpty: [^\n]*\n)", s); assert len(m)==1,(l,len(m))
    s=s.replace(m[0], m[0]+"    auditDeletedPost: '%s',\n"%v); open(p,'w',encoding='utf-8').write(s)
p=R+'src/pages/AdminForum.tsx'; s=open(p,encoding='utf-8').read()
old="'Publicación eliminada' })));"; assert s.count(old)==1
s=s.replace(old,"t('forumAdmin.auditDeletedPost') })));"); open(p,'w',encoding='utf-8').write(s)
print('ok')
