export const dateFormat = (date) => {
    return new Date(date).toLocaleString('en-us',{
        weekday:'short',
        month:'long',
        day:"numeric",
        hour:"numeric",
        minute:'numeric'
    })
}