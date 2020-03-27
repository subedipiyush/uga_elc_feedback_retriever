
import { Builder, By } from 'selenium-webdriver';

import { readFileSync, writeFileSync } from 'fs';

// const URL_ELC_HOME = 'https://cas2.uga.edu/cas/login?service=https://ssomanager-prod.uga.edu:443/ssomanager/c/SSB';
const URL_ELC_HOME = 'https://sso.uga.edu/cas/login?service=https%3a%2f%2fuga.view.usg.edu%2fd2l%2fcustom%2fcas';

const URL_COURSE_HOME = 'https://uga.view.usg.edu/d2l/home/';

const PASSCODES_FILENAME = './config/passcodes.json';

const DEVELOPMENT_MODE = true;

const COURSE_ID = '1955242';

class FeedbackRetriever {

    constructor(username, password, passcode, courseId) {
        this.driver = new Builder()
            .forBrowser('chrome')
            .build();

        this.username = username;
        this.password = password;
        this.passcode = passcode;
        this.courseId = courseId;
    }

    waitWhileThePageLoadsUp(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    async loginToELC() {

        console.log("Logging in to your ELC account");

        await this.driver.get(URL_ELC_HOME);
        let element = await this.driver.findElement({ name: 'username' });
        await element.sendKeys(this.username);
        let element_1 = await this.driver.findElement({ name: 'password' });
        await element_1.sendKeys(this.password);
        await this.click({ name: 'submit' });

        // duo frame begins
        await this.driver.switchTo().frame('duo_iframe');
        await this.click({ id: 'passcode' });
        let element_3 = await this.driver.findElement({ name: 'passcode' });
        await element_3.sendKeys(this.passcode);
        await this.click({ id: 'passcode' });
        await this.driver.switchTo().defaultContent();
    }


    async loadCourseHome() {

        await this.driver.get(URL_COURSE_HOME + this.courseId);

        // TODO : locate course using CRN
        // let course_divs = await this.driver.findElements({ className: 'course-text' });

        // const promises = course_divs.map(async course_div => {
        //     const innerText = await course_div.getText();
            
        //     if (innerText.indexOf(course_id) !== -1) {
        //         return true;
        //     }

        //     return false;
        // });

        // let results_div = await Promise.all(promises);

        // if (!results_div || results_div.length < 1) {
        //     console.error("No course found with the given course id");
        // }

        // await this.driver.executeScript("arguments[0].parentNode.parentNode.click();", results_div[0]);

    }

    async loadGrades() {

        // document.getElementsByTagName("d2l-navigation")[0].getElementsByTagName("d2l-navigation-main-footer")[0].childNodes[0].childNodes[0]

        let navElements = await this.driver.findElements({ tagName: "d2l-navigation" })[0];

        let navFooter = await navElements.findElements({ tagName: "d2l-navigation-main-footer" })[0];

        let navItems = navFooter.findElement(By.xpath(".//div//div"));

        let gradeNavItem = navItems.map(async navItem => {
            let navItemLink = navItem.findElement(By.xpath(".//a"));
            return navItemLink.getText() === "Grades";
        });

        this.click(gradeNavItem);
    }


    async loadCourses() {
        await this.click({ id: 'bmenu--P_StuMainMnu___UID1' });
        await this.waitWhileThePageLoadsUp(2000);
        await this.click({ id: 'bmenu--P_RegMnu___UID0' });
        await this.waitWhileThePageLoadsUp(2000);
        await this.click({ id: 'contentItem12' });
        await this.selectFromList({ name: 'p_term' }, this.term);
        await this.click({ id: 'id____UID6' });
        await this.click({ id: 'id____UID5' });
        await this.selectFromList({ id: 'subj_id' }, this.subject);
        await this.selectFromList({ id: 'levl_id' }, this.courseLevel);
        await this.click({ id: 'id____UID4' });
    }

    async lookIfCoursesAreOpenAndRegister() {

        let element = await this.driver.findElement({ className: 'datadisplaytable' });
        let element_1 = await element.findElement({ tagName: 'tbody' });
        let trs = await element_1.findElements({ tagName: 'tr' });

        const promises = trs.map(async tr => {
            const tds = await tr.findElements({ tagName: 'td' });

            if (tds && tds[7]) {
                const tdText = await tds[7].getText();
                if (this.desiredCourses.indexOf(tdText) !== -1) {
                    const selectionControls = await tds[0].findElements({ name: 'sel_crn' });
                    if (selectionControls && selectionControls.length && selectionControls.length === 1) {
                        console.log(tdText + " is open. Selecting it for registration");
                        await this.driver.executeScript("arguments[0].click();", selectionControls[0]);

                        return true;
                    }
                }
            }

            return false;
        });

        let results = await Promise.all(promises);
        results = results.filter((result) => { return result === true; });
        if (results.length > 0) {
            // this means we were able to select one of the desired courses
            console.log(results.length + " of the desired courses were available and have been selected for registration. Saving the registration");
            if(!DEVELOPMENT_MODE) {
                await this.click({ id: "id____UID4" });
            }
        } else {
            console.log("No courses were registered possibly due to unavailability");
        }

    }

    async click(elem) {
        let element = await this.driver.findElement(elem);

        // using executeScript instead of click() because click() has an issue when the element being clicked is not in the view
        //await element.click();
        await this.driver.executeScript("arguments[0].click();", element);

    }

    async selectFromList(selectElement, optionToSelect) {
        let element = await this.driver.findElement(selectElement);

        await element.sendKeys(optionToSelect);
    }


    async start() {
        await this.loginToELC();
        await this.waitWhileThePageLoadsUp(5000);
        await this.loadCourseHome();
        await this.loadGrades();
        // await this.lookIfCoursesAreOpenAndRegister();
        await this.driver.close();

    }

}


function getConfig() {
    return JSON.parse(readFileSync('./config/config.json'), 'utf8');
}

function getPassCodes() {
    return JSON.parse(readFileSync(PASSCODES_FILENAME, 'utf8'));
}

function setPassCodes(passCodes) {
    writeFileSync(PASSCODES_FILENAME, JSON.stringify(passCodes), 'utf8');
}


async function startJob() {

    let job = undefined;

    let passCodes = getPassCodes();

    if(passCodes && passCodes.length > 0) {
        const config = getConfig();

        let automater = new FeedbackRetriever(config.MY_USERNAME, config.MY_PASSWORD, passCodes[0], COURSE_ID);
        
        try {
            await automater.start();
        } catch(error) {
            console.log("There was an error. " + JSON.stringify(error));
            // consuming error such that the job can retry; maybe one of the passcodes was wrong 
        }

        // remove the used passcode
        setPassCodes(passCodes.slice(1));
        
        if(!job) {
            job = setInterval(startJob, config.INTERVAL_IN_MINS * 60 * 1000);
        }

    } else {
        console.log("OUT OF PASSCODES. CANNOT PROCEED. FILL THE passcodes.json WITH VALID PASSCODES TO PROCEED");
        if(job) {
            clearInterval(job);
        }
    }

}

startJob();