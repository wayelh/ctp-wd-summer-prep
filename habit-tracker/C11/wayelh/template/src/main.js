const form = document.getElementById('habit_form')
const habits = []
form.addEventListener('submit', (event) => {
    event.preventDefault()

    const data = new FormData(event.target)

   // console.log(Array.from(data.keys()))

    const habit = {
        name: data.get('habit_name'),
        targetStreak: Number(data.get('target_streak'))
    }

    habits.push(habit)
    console.log(JSON.stringify(habits))

    renderHabits
})

const renderHabits = (habits) => {
    const document.getElementById('habit_list')
    
    habitList(habits.map(habit => {
        return `<li>${habit.name} ${habit.targetStreak}</li>`
    }).join(`\n`))
        
}
habitList.innerHTML = `
    
//function renderHabits(){

}
//const renderHabits = function (){

}


