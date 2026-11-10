// Remembers each app tab's last route (composables/useAppNav.ts).
export default defineNuxtPlugin(() => {
  const router = useRouter()
  router.afterEach((to) => rememberTab(to.fullPath))
})
